import * as vscode from 'vscode';
import { getAllVisibleBundles } from './get-bundle';
import { Bundle, FhirResource } from 'fhir/r4';
import { fhirBundlesMatch } from '@careevolution/fhir-diff';
const jsonMap = require('json-source-map');

export class BundleResourcesTreeProvider implements vscode.TreeDataProvider<FhirResourceTreeItem> {

  constructor() {
    // Register a listener for changes to the active text editor so that we can refresh the tree
    vscode.window.onDidChangeActiveTextEditor(this.refresh, this);

    // Register the command that will be issued when the user clicks on a tree item
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
      } else if (bundles.length > 1) {
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
      this.clearHighlights(vscode.window.visibleTextEditors[0]);
      this.clearHighlights(vscode.window.visibleTextEditors[1]);
      this.showResource(vscode.window.visibleTextEditors[0], node.lineNumberA, node.endLineNumberA);
      this.showResource(vscode.window.visibleTextEditors[1], node.lineNumberB, node.endLineNumberB);
    } else {
      const activeEditor = vscode.window.activeTextEditor;
      this.clearHighlights(activeEditor);
      this.showResource(activeEditor, node.lineNumberA, node.endLineNumberA);
    }
  }

  private highlightDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(255, 255, 0, 0.3)' // Yellow highlight
  });

  private clearHighlights(editor: vscode.TextEditor | undefined) {
    editor?.setDecorations(this.highlightDecorationType, []); // Pass an empty array to remove all decorations
  }

  private showResource(editor: vscode.TextEditor | undefined, startLineNumber: number | undefined, endLineNumber: number | undefined) {
    if (!editor || !startLineNumber || !endLineNumber) { return; }
  
    const startPosition = new vscode.Position(startLineNumber, 0);
    const endPosition = new vscode.Position(endLineNumber, 0);
    const range = new vscode.Range(startPosition, endPosition);
    editor.selection = new vscode.Selection(startPosition, startPosition);
    editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
    editor.setDecorations(this.highlightDecorationType, [range]);
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
        const resourceId = resource.id || '';
        const resourceLabel = resourceId.slice(0,7) || resourceType;
        const lineNumbers = this.lineNumberDictionaryA.hasOwnProperty(resourceId) ? this.lineNumberDictionaryA[resourceId] : undefined;
        this.addResourceToResourceTypes(resourceType, resourceLabel, resourceId, false, lineNumbers);
      }
    });

    // Order the resource types alphabetically
    const sortedResourceTypes = Object.keys(this.resourceTypes).sort();
    return sortedResourceTypes.map(resourceType => 
      new FhirResourceTreeItem(
        resourceType,
        '',
        this.resourceTypes[resourceType].length, 
        vscode.TreeItemCollapsibleState.Collapsed,
        false
      )
    );
  }

  private getResourceInstances( resourceType: string ): FhirResourceTreeItem[] {

    // Get the entries corresponding to the resource type
    var resourceInstances = this.resourceTypes.hasOwnProperty(resourceType) ? this.resourceTypes[resourceType] : [];
    return resourceInstances
      .map( resourceInfo => {
        return new FhirResourceTreeItem(
          resourceInfo.resourceLabel,
          resourceInfo.resourceId,
          0,
          vscode.TreeItemCollapsibleState.None,
          resourceInfo.isDiff,
          resourceInfo.lineNumberA,
          resourceInfo.endLineNumberA,
          resourceInfo.lineNumberB,
          resourceInfo.endLineNumberB);
      });
  }

  private getDiffTree(bundleA: Bundle, bundleB: Bundle): FhirResourceTreeItem[] {

    this.resourceTypes = {};
    this.lineNumberDictionaryA = {};
    this.lineNumberDictionaryB = {};

    const diffInfo = fhirBundlesMatch(bundleA, bundleB);
    if (!diffInfo) { return []; }

    this.fillLineNumberDictionary(vscode.window.visibleTextEditors[0].document, this.lineNumberDictionaryA);
    this.fillLineNumberDictionary(vscode.window.visibleTextEditors[1].document, this.lineNumberDictionaryB);

    const bundleAResources = this.getResourceDictionary(bundleA);
    const bundleBResources = this.getResourceDictionary(bundleB);

    // Create a single dictionary with all the resources
    diffInfo.bundle1Only.forEach( item => {
      if (!item.reference) { return; }
      const resource = bundleAResources.hasOwnProperty(item.reference) ? bundleAResources[item.reference] : undefined;
      if (!resource) { return; }
      const resourceType = resource.resourceType as string;
      const resourceId = resource.id || '';
      const resourceLabel = resourceId.slice(0,7) || resourceType;
      const lineNumbers = this.lineNumberDictionaryA.hasOwnProperty(resourceId) ? this.lineNumberDictionaryA[resourceId] : undefined;
      this.addResourceToResourceTypes(resourceType, resourceLabel, resourceId, true, lineNumbers);
    });
    diffInfo.bundle2Only.forEach( item => {
      if (!item.reference) { return; }
      const resource = bundleBResources.hasOwnProperty(item.reference) ? bundleBResources[item.reference] : undefined;
      if (!resource) { return; }
      const resourceType = resource.resourceType as string;
      const resourceId = resource.id || '';
      const resourceLabel = resourceId.slice(0,7) || resourceType;
      const lineNumbers = this.lineNumberDictionaryB.hasOwnProperty(resourceId) ? this.lineNumberDictionaryB[resourceId] : undefined;
      this.addResourceToResourceTypes(resourceType, resourceLabel, resourceId, true, undefined, lineNumbers);
    });
    diffInfo.common.forEach(item => {
      if (!item.bundle1.reference || !item.bundle2.reference) { return; }
      const resourceA = bundleAResources.hasOwnProperty(item.bundle1.reference) ? bundleAResources[item.bundle1.reference] : undefined;
      const resourceB = bundleBResources.hasOwnProperty(item.bundle2.reference) ? bundleBResources[item.bundle2.reference] : undefined;
      if (!resourceA || !resourceB) { return; }
      const resourceTypeA = resourceA.resourceType;
      const resourceTypeB = resourceB.resourceType;
      const resourceAId = resourceA.id || '';
      const resourceBId = resourceB.id || '';
      const resourceLabel = `${resourceAId.slice(0,7) || resourceTypeA} - ${resourceBId.slice(0,7) || resourceTypeB}`;
      const lineNumbersA = this.lineNumberDictionaryA.hasOwnProperty(resourceAId) ? this.lineNumberDictionaryA[resourceAId] : undefined;
      const lineNumbersB = this.lineNumberDictionaryB.hasOwnProperty(resourceBId) ? this.lineNumberDictionaryB[resourceBId] : undefined;
      if (resourceTypeA === resourceTypeB) {
        this.addResourceToResourceTypes(resourceTypeA, resourceLabel, '', true, lineNumbersA, lineNumbersB);
      } else {
        this.addResourceToResourceTypes(`${resourceTypeA} - ${resourceTypeB}`, resourceLabel, '', true, lineNumbersA, lineNumbersB);
      }
    });

    // Order the resource types alphabetically
    const sortedResourceTypes = Object.keys(this.resourceTypes).sort();
    return sortedResourceTypes.map(resourceType => 
      new FhirResourceTreeItem(
        resourceType,
        '',
        this.resourceTypes[resourceType].length, 
        vscode.TreeItemCollapsibleState.Collapsed,
        true
      )
    );
  }

  private getResourceDictionary(bundle: Bundle): { [id: string]: FhirResource } {
    const bundleResources: { [id: string]: FhirResource } = {};
    bundle.entry?.forEach(entry => {
      const resource = entry.resource;
      if (!resource) { return; }
      const reference = `${resource.resourceType}/${resource.id}`;
      bundleResources[reference] = resource;
    });
    return bundleResources;
  }

  private addResourceToResourceTypes(
    resourceType: string, 
    resourceLabel: string, 
    resourceId: string,
    isDiff: boolean, 
    lineNumbersA?: { startLineNumber: number, endLineNumber: number }, 
    lineNumbersB?: { startLineNumber: number, endLineNumber: number }, 
  ) {
    if (resourceType) {
      const resourceInfo = { 
        resourceType,
        resourceLabel,
        resourceId,
        isDiff, 
        lineNumberA: lineNumbersA?.startLineNumber,
        endLineNumberA: lineNumbersA?.endLineNumber,
        lineNumberB: lineNumbersB?.startLineNumber,
        endLineNumberB: lineNumbersB?.endLineNumber,
       };
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
    if (!documentText) { return; }

    const result = jsonMap.parse(documentText);
    if (!result || !result.data || !result.pointers) { return; }
    const jsonObject = result.data as Bundle;
    if (!jsonObject?.entry) { return; }
    const nResources = jsonObject.entry.length;
    for ( let ii = 0; ii < nResources; ii++) {
      const resource = jsonObject.entry[ii].resource as FhirResource;
      if (!resource) { continue; }
      const resourceId = resource.id || '';
      const pointerKey = `/entry/${ii}`;
      const pointers = result.pointers.hasOwnProperty(pointerKey) ? result.pointers[pointerKey] : undefined;
      if (!pointers) { continue; }
      const resourceStartLineNumber = pointers.value?.line || 0;
      const resourceEndLineNumber = pointers.valueEnd?.line || 0;
      lineNumberDictionary[resourceId] = { startLineNumber: resourceStartLineNumber, endLineNumber: resourceEndLineNumber };
    }
  }

  private _onDidChangeTreeData: vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<FhirResourceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
}

class FhirResourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string, // This is resourceType (branch) or id (leaf)
    public readonly resourceId: string,
    public readonly nChildren: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isDiff: boolean,
    public readonly lineNumberA?: number,
    public readonly endLineNumberA?: number,
    public readonly lineNumberB?: number,
    public readonly endLineNumberB?: number
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
  resourceId: string;
  isDiff: boolean;
  lineNumberA?: number;
  endLineNumberA?: number;
  lineNumberB?: number;
  endLineNumberB?: number;
}
