import * as vscode from 'vscode';
import { getAllVisibleBundles } from './get-bundle';
import { Bundle, FhirResource } from 'fhir/r4';

export class BundleResourcesTreeProvider implements vscode.TreeDataProvider<FhirResourceTreeItem> {

  constructor() {
    // Register a listener for changes to the active text editor
    vscode.window.onDidChangeActiveTextEditor(this.refresh, this);
    vscode.commands.registerCommand('fhirResources.item_clicked', r => this.handleTreeItemClick(r));
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
      const bundles = getAllVisibleBundles();
      if (bundles.length === 1) {
        return Promise.resolve(this.getResourcesFromBundle(bundles[0].json));
      } else if (bundles.length === 2) {
        return Promise.resolve(this.getDiffTree(bundles[0].json, bundles[1].json));
      } else {
        return Promise.resolve([]);
      }
    }
  }

  // Method to handle item click
  handleTreeItemClick(node: FhirResourceTreeItem) {
    if (node.collapsibleState !== vscode.TreeItemCollapsibleState.None) { return; }

    if (node.isDiff) {
      this.showResource(vscode.window.visibleTextEditors[0], node.lineNumberA);
      this.showResource(vscode.window.visibleTextEditors[1], node.lineNumberB);
    } else {
      const activeEditor = vscode.window.activeTextEditor;
      this.showResource(activeEditor, node.lineNumberA);
    }
  }

  private showResource(editor: vscode.TextEditor | undefined, lineNumber: number | undefined) {
    if (!editor || !lineNumber) { return; }
  
    const position = new vscode.Position(lineNumber, 0); // 0-indexed line number
    const otherPosition = new vscode.Position(lineNumber+20, 0);
    const range = new vscode.Range(position, otherPosition);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range);
  }

  private resourceTypes: {[id: string]: FhirResourceInfo[]} = {};
  private lineNumberDictionary: { [id: string]: {lineNumber: number; position: number} } = {};

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
      new FhirResourceTreeItem(
        resourceType, 
        this.resourceTypes[resourceType].length, 
        vscode.TreeItemCollapsibleState.Collapsed,
        false
      )
    );
  }

  private getResourceInstances( resourceType: string ): FhirResourceTreeItem[] {

    // Get the entries corresponding to the resource type
    var resourceInstances = this.resourceTypes[resourceType];
    return resourceInstances
      .map( resourceInfo => {
        const resourceId = resourceInfo.resource.id || 'no ID';
        const lineNumberInfo = this.lineNumberDictionary[resourceId];
        return new FhirResourceTreeItem(
          resourceId,
          0,
          vscode.TreeItemCollapsibleState.None,
          false,
          lineNumberInfo.lineNumber);
      });
  }

  private getDiffTree(bundleA: Bundle, bundleB: Bundle): FhirResourceTreeItem[] {
    return [];
  }

  private _onDidChangeTreeData: vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<FhirResourceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
}

class FhirResourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string, // This is resourceType (branch) or id (leaf)
    public readonly nChildren: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isDiff: boolean,
    public readonly lineNumberA?: number,
    public readonly lineNumberB?: number,
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;

    if (nChildren > 0) {
      this.description = `(${nChildren})`;
    } else {
      if (isDiff) {
        if (lineNumberA !== undefined && lineNumberB !== undefined) {
          this.description = 'A and B';
        } else if (lineNumberA !== undefined) {
          this.description = 'A';
        } else if (lineNumberB !== undefined) {
          this.description = 'B';
        }
      } else {
        this.description = '';
      }
    }
  }

  // Method to handle click event
  command = { command: 'fhirResources.item_clicked', title: '', arguments: [this] };
}

interface FhirResourceInfo {
  resource: FhirResource;
  position?: vscode.Position;
  lineNumber?: number;
}
