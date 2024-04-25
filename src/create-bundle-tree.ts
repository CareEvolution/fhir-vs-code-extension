import * as vscode from 'vscode';
import { getBundle } from './get-bundle';
import { Bundle, FhirResource, Resource } from 'fhir/r4';

export class BundleResourcesTreeProvider implements vscode.TreeDataProvider<FhirResourceTreeItem> {

  constructor() {
    // Register a listener for changes to the active text editor
    vscode.window.onDidChangeActiveTextEditor(this.refresh, this);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FhirResourceTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FhirResourceTreeItem): Thenable<FhirResourceTreeItem[]> {

    if (element) {
      return Promise.resolve(
        this.getResourceInstances(element.label)
      );
    } else {
      const bundleInfo = getBundle();
      if (bundleInfo) {
        return Promise.resolve(this.getResourcesFromBundle(bundleInfo.json));
      } else {
        return Promise.resolve([]);
      }
    }
  }

  private resourceTypes: {[id: string]: FhirResourceInfo[]} = {};
  private lineNumberDictionary: { [id: string]: {lineNumber: number; position: number} } = {};

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getResourcesFromBundle(json: Bundle): FhirResourceTreeItem[] {

    this.resourceTypes = {};
    this.lineNumberDictionary = {};

    if (!json.entry) { return []; }

    const activeTextEditor = vscode.window.activeTextEditor;  
    const document = activeTextEditor?.document;
    const documentText = document?.getText();

    const lines = documentText?.split("\n");

    const searchString = "\"id\"";
    const searchStringLength = searchString.length;

    lines?.forEach((line, lineNumber) => {

      if (line.length === 0) { return; }

      let index = 0;
      let startIndex = 0;
      while ((index = line.indexOf(searchString, startIndex)) > -1) {
        // I need to store the line and position of each resource
        // I need to get the resource id value, which will be the text between the next two \"'s.
        const firstQuoteIndex = line.indexOf("\"", index + searchStringLength);
        const secondQuoteIndex = line.indexOf("\"", firstQuoteIndex+1);
        const id = line.slice(firstQuoteIndex+1, secondQuoteIndex);
        this.lineNumberDictionary[id] = { lineNumber, position: index };
        startIndex = index + searchStringLength;
      }
    });



    // Create a dictionary with all the resources
    json.entry.forEach( entry => {
      const resource = entry.resource;
      if (resource) {
        const resourceType = resource.resourceType as string;
        if (resourceType){
          if (!this.resourceTypes.hasOwnProperty(resourceType)){
            this.resourceTypes[resourceType] = [ { resource } ];
          } else {
            this.resourceTypes[resourceType].push( { resource });
          }
        }
      }
    });

    // Order the resource types alphabetically
    const sortedResourceTypes = Object.keys(this.resourceTypes).sort();
    return sortedResourceTypes.map(resourceType => 
      new FhirResourceTreeItem(resourceType, this.resourceTypes[resourceType].length, 0, vscode.TreeItemCollapsibleState.Collapsed));
  }

  private getResourceInstances( resourceType: string ): FhirResourceTreeItem[] {

    // Get the entries corresponding to the resource type
    var resourceInstances = this.resourceTypes[resourceType];
    return resourceInstances
      .map( resourceInfo => {
        const resourceId = resourceInfo.resource.id || 'no ID';
        const lineNumberInfo = this.lineNumberDictionary[resourceId];
        return new FhirResourceTreeItem(resourceId, 0, lineNumberInfo.lineNumber, vscode.TreeItemCollapsibleState.None);
      });
  }

  private _onDidChangeTreeData: vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<FhirResourceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
}

class FhirResourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly nChildren: number,
    public readonly lineNumber: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.description = nChildren > 0 ? `(${nChildren})` : `(${lineNumber})`;
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };
}

interface FhirResourceInfo {
  resource: FhirResource;
  position?: vscode.Position;
  lineNumber?: number;
}
