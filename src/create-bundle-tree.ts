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

  private resourceTypes: {[id: string]: FhirResource[]} = {};

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getResourcesFromBundle(json: Bundle): FhirResourceTreeItem[] {

    this.resourceTypes = {};

    if (!json.entry) { return []; }

    // Create a dictionary with all the resources
    json.entry.forEach( entry => {
      const resource = entry.resource;
      if (resource) {
        const resourceType = resource.resourceType as string;
        if (resourceType){
          if (!this.resourceTypes.hasOwnProperty(resourceType)){
            this.resourceTypes[resourceType] = [ resource ];
          } else {
            this.resourceTypes[resourceType].push(resource);
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
      .map( resource => new FhirResourceTreeItem(resource.id || "no id", 0, 0, vscode.TreeItemCollapsibleState.None));
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
    this.description = nChildren > 0 ? `(${nChildren})` : '';
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };
}
