import * as vscode from 'vscode';
import { getAllVisibleBundles } from './get-bundle';
import { Bundle, FhirResource } from 'fhir/r4';
import { fhir_bundles_match } from '@careevolution/fhir-diff';

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
  private lineNumberDictionaryA: { [id: string]: { startLineNumber: number; endLineNumber: number } } = {};
  private lineNumberDictionaryB: { [id: string]: { startLineNumber: number; endLineNumber: number } } = {};

  private getResourcesFromBundle(json: Bundle): FhirResourceTreeItem[] {

    this.resourceTypes = {};
    this.lineNumberDictionaryA = {};
    this.lineNumberDictionaryB = {};

    if (!json.entry) { return []; }

    const activeTextEditor = vscode.window.activeTextEditor;  
    const document = activeTextEditor?.document;

    this.fillLineNumberDictionary(document, this.lineNumberDictionaryA);

    // Create a dictionary with all the resources
    json.entry.forEach( entry => {
      const resource = entry.resource;
      if (resource) {
        const resourceType = resource.resourceType as string;
        const resourceId = resource.id || 'No ID';
        const lineNumber = this.lineNumberDictionaryA[resourceId]?.startLineNumber;
        if (resourceType){
          const resourceInfo = { resourceType, resourceLabel: resource.id || 'No ID', isDiff: false, lineNumberA: lineNumber };
          if (!this.resourceTypes.hasOwnProperty(resourceType)){
            this.resourceTypes[resourceType] = [ resourceInfo ];
          } else {
            this.resourceTypes[resourceType].push( resourceInfo );
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
        const resourceId = resourceInfo.resourceLabel;
        return new FhirResourceTreeItem(
          resourceId,
          0,
          vscode.TreeItemCollapsibleState.None,
          resourceInfo.isDiff,
          resourceInfo.lineNumberA,
          resourceInfo.lineNumberB);
      });
  }

  private getDiffTree(bundleA: Bundle, bundleB: Bundle): FhirResourceTreeItem[] {

    this.resourceTypes = {};
    this.lineNumberDictionaryA = {};
    this.lineNumberDictionaryB = {};

    const diffInfo = fhir_bundles_match(bundleA, bundleB);
    if (!diffInfo) { return []; }

    this.fillLineNumberDictionary(vscode.window.visibleTextEditors[0].document, this.lineNumberDictionaryA);
    this.fillLineNumberDictionary(vscode.window.visibleTextEditors[1].document, this.lineNumberDictionaryB);

    const bundleAResources: { [id: string]: FhirResource} = {};
    bundleA.entry?.forEach(entry => {
      const resource = entry.resource;
      if (!resource) { return; }

      const reference = `${resource.resourceType}/${resource.id}`;
      bundleAResources[reference] = resource;
    });

    const bundleBResources: { [id: string]: FhirResource} = {};
    bundleB.entry?.forEach(entry => {
      const resource = entry.resource;
      if (!resource) { return; }

      const reference = `${resource.resourceType}/${resource.id}`;
      bundleBResources[reference] = resource;
    });

    // Create a dictionary with all the resources
    diffInfo.bundle1Only.forEach( item => {
      if (!item.reference) { return; }
      const resource = bundleAResources[item.reference];
      const resourceId = resource.id || 'No ID';
      const lineNumber = this.lineNumberDictionaryA[resourceId]?.startLineNumber;
      this.addResourceToResourceTypes(resource, resourceId, true, lineNumber);
    });
    diffInfo.bundle2Only.forEach( item => {
      if (!item.reference) { return; }
      const resource = bundleBResources[item.reference];
      const resourceId = resource.id || 'No ID';
      const lineNumber = this.lineNumberDictionaryB[resourceId]?.startLineNumber;
      this.addResourceToResourceTypes(resource, resourceId, true, undefined, lineNumber);
    });
    diffInfo.common.forEach(item => {
      if (!item.bundle1.reference || !item.bundle2.reference) { return; }
      const resourceA = bundleAResources[item.bundle1.reference];
      const resourceB = bundleBResources[item.bundle2.reference];
      const resourceTypeA = resourceA.resourceType;
      const resourceTypeB = resourceB.resourceType;
      const lineNumberA = this.lineNumberDictionaryA[resourceA.id || '']?.startLineNumber;
      const lineNumberB = this.lineNumberDictionaryB[resourceB.id || '']?.startLineNumber;
      if (resourceTypeA === resourceTypeB) {
        this.addResourceToResourceTypes(resourceA, 'Foo', true, lineNumberA, lineNumberB);
      } else {
        this.addResourceToResourceTypes(resourceA, 'Foo', true, lineNumberA, lineNumberB, `${resourceTypeA} - ${resourceTypeB}`);
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

  private addResourceToResourceTypes(resource: FhirResource, resourceLabel: string, isDiff: boolean, lineNumberA?: number, lineNumberB?: number, resourceType?: string) {
    resourceType = resourceType || resource.resourceType as string;
    if (resourceType) {
      const resourceInfo = { resourceType, resourceLabel, isDiff, lineNumberA, lineNumberB };
      if (!this.resourceTypes.hasOwnProperty(resourceType)){
        this.resourceTypes[resourceType] = [ resourceInfo ];
      } else {
        this.resourceTypes[resourceType].push(resourceInfo);
      }
    }
  }

  private fillLineNumberDictionary(document: vscode.TextDocument | undefined, 
    lineNumberDictionary: { [id: string]: { startLineNumber: number; endLineNumber: number} }
  ) {
    
    const documentText = document?.getText();

    const lines = documentText?.split("\n");

    const resourceStartString = "      \"resource\": {";
    const resourceEndString = "    }";
    const searchString = "\"id\"";
    const searchStringLength = searchString.length;

    let inResource = false;
    let resourceStartLineNumber = -1;
    let foundId = false;
    let resourceId: string = ''; 

    lines?.forEach((line, lineNumber) => {

      if (!inResource) {
        if (line.startsWith(resourceStartString)) {
          inResource = true;
          resourceStartLineNumber = lineNumber;
        }
      } else if (!foundId) {
        let index = line.indexOf(searchString);
        if ( index > -1 ) {
          // I need to store the line and position of each resource
          // I need to get the resource id value, which will be the text between the next two \"'s.
          const firstQuoteIndex = line.indexOf("\"", index + searchStringLength);
          const secondQuoteIndex = line.indexOf("\"", firstQuoteIndex + 1);
          resourceId = line.slice(firstQuoteIndex + 1, secondQuoteIndex);
          foundId = true;
        }
      } else {
        if (line.startsWith(resourceEndString)) {
          lineNumberDictionary[resourceId] = { startLineNumber: resourceStartLineNumber, endLineNumber: lineNumber };
          inResource = false;
          resourceStartLineNumber = -1;
          foundId = false;
          resourceId = '';
        }
      }
    });
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
  resourceType: string;
  resourceLabel: string;
  isDiff: boolean;
  lineNumberA?: number;
  endLineNumberA?: number;
  lineNumberB?: number;
  endLineNumberB?: number;
}
