import * as vscode from 'vscode';
import { getAllVisibleBundles } from './get-bundle';
import { Bundle, BundleEntry, Identifier, FhirResource } from 'fhir/r4';
import { fhirBundlesMatch, buildFhirReference } from '@careevolution/fhir-diff';
const jsonMap = require('json-source-map');

export class BundleResourcesTreeProvider implements vscode.TreeDataProvider<FhirResourceTreeItem> {

  private highlightDecorationType: vscode.TextEditorDecorationType | undefined;

  constructor() {
    // Register a listener for changes to the active text editor so that we can refresh the tree
    vscode.window.onDidChangeActiveTextEditor(this.refresh, this);

    // Register the command that will be issued when the user clicks on a tree item
    vscode.commands.registerCommand('fhirResources.item_clicked', r => this.handleTreeItemClick(r));

    vscode.commands.registerCommand('fhir-toolkit-extension.toggleAOnlyOn', () => this.toggleAOnly());
    vscode.commands.registerCommand('fhir-toolkit-extension.toggleAOnlyOff', () => this.toggleAOnly());
    vscode.commands.registerCommand('fhir-toolkit-extension.toggleBOnlyOn', () => this.toggleBOnly());
    vscode.commands.registerCommand('fhir-toolkit-extension.toggleBOnlyOff', () => this.toggleBOnly());
    vscode.commands.registerCommand('fhir-toolkit-extension.toggleAAndBOn', () => this.toggleAAndB());
    vscode.commands.registerCommand('fhir-toolkit-extension.toggleAAndBOff', () => this.toggleAAndB());

    vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.showA', this.showAOnly);
    vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.showB', this.showBOnly);
    vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.showAB', this.showAAndB);

    this.setHighlightColor();

    // Listen for theme changes
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('workbench.colorTheme')) {
          this.setHighlightColor();
      }
    });
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
      vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.isDiff', false);
      const bundles = getAllVisibleBundles();
      if (bundles.length === 1) {
        return Promise.resolve(this.getResourcesFromBundle(bundles[0].json));
      } else if (bundles.length > 1) {
        vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.isDiff', true);
        return Promise.resolve(this.getDiffTree(bundles[0].json, bundles[1].json));
      } else {
        return Promise.resolve([]);
      }
    }
  }

  toggleAOnly() {
    this.showAOnly = !this.showAOnly;
    vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.showA', this.showAOnly);
    this.refresh();
  }

  toggleBOnly() {
    this.showBOnly = !this.showBOnly;
    vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.showB', this.showBOnly);
    this.refresh();
  }

  toggleAAndB() {
    this.showAAndB = !this.showAAndB;
    vscode.commands.executeCommand('setContext', 'fhir-toolkit-extension.showAB', this.showAAndB);
    this.refresh();
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

  private setHighlightColor() {
    vscode.window.visibleTextEditors.forEach(te => this.clearHighlights(te));
    const colorThemeKind = vscode.window.activeColorTheme.kind;
    switch (colorThemeKind) {
      case vscode.ColorThemeKind.Light:
        case vscode.ColorThemeKind.HighContrast:
          case vscode.ColorThemeKind.HighContrastLight:
          this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: 'rgba(255, 255, 0, 0.3)'
          });
          break;
      case vscode.ColorThemeKind.Dark:
          this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
          isWholeLine: true,
          backgroundColor: 'rgba(255, 255, 0, 0.1)'
        });
        break;
      default:
          console.log('Unknown theme.');
          break;
    }
  }

  private clearHighlights(editor: vscode.TextEditor | undefined) {
    if (this.highlightDecorationType) {
      editor?.setDecorations(this.highlightDecorationType, []); // Pass an empty array to remove all decorations
    }
  }

  private showResource(editor: vscode.TextEditor | undefined, startLineNumber: number | undefined, endLineNumber: number | undefined) {
    if (!editor || !startLineNumber || !endLineNumber) { return; }
  
    const startPosition = new vscode.Position(startLineNumber, 0);
    const endPosition = new vscode.Position(endLineNumber, 0);
    const range = new vscode.Range(startPosition, endPosition);
    editor.selection = new vscode.Selection(startPosition, startPosition);
    editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
    if (this.highlightDecorationType) {
      editor.setDecorations(this.highlightDecorationType, [range]);
    }
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
    for (let entry of json.entry) {
      const resource = entry.resource;
      if (!resource) { continue; }
      const resourceType = resource.resourceType as string;
      const resourceId = this.getResourceIdentifier(entry);
      if (!resourceId) { continue; }
      const resourceLabel = this.getResourceIdLabel(resourceId) || resourceType;
      const lineNumbers = this.lineNumberDictionaryA.hasOwnProperty(resourceId) ? this.lineNumberDictionaryA[resourceId] : undefined;
      this.addResourceToResourceTypes(resourceType, resourceLabel, resourceId, false, lineNumbers);
    };

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
    if (this.showAOnly) {
      for (let item of diffInfo.bundle1Only) {
        if (!item.reference) { continue; }
        const entry = bundleAResources.hasOwnProperty(item.reference) ? bundleAResources[item.reference] : undefined;
        if (!entry || !entry.resource) { continue; }
        const resourceType = entry.resource.resourceType as string;
        const resourceId = this.getResourceIdentifier(entry);
        if (!resourceId) { continue; }
        const resourceLabel = this.getResourceIdLabel(resourceId) || resourceType;
        const lineNumbers = this.lineNumberDictionaryA.hasOwnProperty(resourceId) ? this.lineNumberDictionaryA[resourceId] : undefined;
        this.addResourceToResourceTypes(resourceType, resourceLabel, resourceId, true, lineNumbers);
      };
    }
    if (this.showBOnly) {
      for (let item of diffInfo.bundle2Only) {
        if (!item.reference) { continue; }
        const entry = bundleBResources.hasOwnProperty(item.reference) ? bundleBResources[item.reference] : undefined;
        if (!entry || !entry.resource) { continue; }
        const resourceType = entry.resource.resourceType as string;
        const resourceId = this.getResourceIdentifier(entry);
        if (!resourceId) { continue; }
        const resourceLabel = this.getResourceIdLabel(resourceId) || resourceType;
        const lineNumbers = this.lineNumberDictionaryB.hasOwnProperty(resourceId) ? this.lineNumberDictionaryB[resourceId] : undefined;
        this.addResourceToResourceTypes(resourceType, resourceLabel, resourceId, true, undefined, lineNumbers);
      };
    }
    if (this.showAAndB) {
      for (let item of diffInfo.common) {
        if (!item.bundle1.reference || !item.bundle2.reference) { continue; }
        const entryA = bundleAResources.hasOwnProperty(item.bundle1.reference) ? bundleAResources[item.bundle1.reference] : undefined;
        const entryB = bundleBResources.hasOwnProperty(item.bundle2.reference) ? bundleBResources[item.bundle2.reference] : undefined;
        if (!entryA || !entryA.resource || !entryB || !entryB.resource) { continue; }
        const resourceTypeA = entryA.resource.resourceType;
        const resourceTypeB = entryB.resource.resourceType;
        const resourceAId = this.getResourceIdentifier(entryA);
        const resourceBId = this.getResourceIdentifier(entryB);
        if (!resourceAId || !resourceBId) { continue; }
        const resourceLabel = `${this.getResourceIdLabel(resourceAId) || resourceTypeA} - ${this.getResourceIdLabel(resourceBId) || resourceTypeB}`;
        const lineNumbersA = this.lineNumberDictionaryA.hasOwnProperty(resourceAId) ? this.lineNumberDictionaryA[resourceAId] : undefined;
        const lineNumbersB = this.lineNumberDictionaryB.hasOwnProperty(resourceBId) ? this.lineNumberDictionaryB[resourceBId] : undefined;
        if (resourceTypeA === resourceTypeB) {
          this.addResourceToResourceTypes(resourceTypeA, resourceLabel, '', true, lineNumbersA, lineNumbersB);
        } else {
          this.addResourceToResourceTypes(`${resourceTypeA} - ${resourceTypeB}`, resourceLabel, '', true, lineNumbersA, lineNumbersB);
        }
      };
    }

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

  private getResourceDictionary(bundle: Bundle): { [id: string]: BundleEntry<FhirResource> } {
    const bundleResources: { [id: string]: BundleEntry<FhirResource> } = {};
    bundle.entry?.forEach(entry => {
      const resource = entry.resource;
      if (!resource) { return; }
      const reference = buildFhirReference(entry);
      if (!reference?.reference) { return; }
      bundleResources[reference.reference] = entry;
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
      const resourceId = this.getResourceIdentifier(jsonObject.entry[ii]);
      if (!resourceId) { continue; }
      const pointerKey = `/entry/${ii}`;
      const pointers = result.pointers.hasOwnProperty(pointerKey) ? result.pointers[pointerKey] : undefined;
      if (!pointers) { continue; }
      const resourceStartLineNumber = pointers.value?.line || 0;
      const resourceEndLineNumber = pointers.valueEnd?.line || 0;
      lineNumberDictionary[resourceId] = { startLineNumber: resourceStartLineNumber, endLineNumber: resourceEndLineNumber };
    }
  }

  private getResourceIdLabel(id: string): string {
    if (id.startsWith('urn:uuid:')) {
      return id.slice(9, 16);
    } else if (this.isGuid(id)) {
      return id.slice(0,7);
    } else {
      return id;
    }
  }

  private isGuid(id: string): boolean {
    // Note: this is with or without dashes
    const guidPattern = /^(?:\{{0,1}(?:[0-9a-fA-F]){8}(?:-){0,1}(?:[0-9a-fA-F]){4}(?:-){0,1}(?:[0-9a-fA-F]){4}(?:-){0,1}(?:[0-9a-fA-F]){4}(?:-){0,1}(?:[0-9a-fA-F]){12}\}{0,1})$/;
    return guidPattern.test(id);
  }

  private getResourceIdentifier(entry: BundleEntry<FhirResource>): string | undefined | null {

    if (!entry.resource) {
      return undefined;
    }
  
    if (entry.resource.id) {
      return entry.resource.id;
    }
  
    if (entry.fullUrl) {
      return entry.fullUrl;
    }
  
    switch (entry.resource.resourceType) {
      case 'Patient':
      case 'Encounter':
      case 'Condition':
      case 'MedicationAdministration':
      case 'MedicationRequest':
      case 'MedicationDispense':
      case 'MedicationStatement':
      case 'Medication':
      case 'Immunization':
      case 'Procedure':
      case 'ServiceRequest':
      case 'AllergyIntolerance':
      case 'Observation':
      case 'DiagnosticReport':
      case 'DocumentReference':
      case 'Practitioner':
      case 'PractitionerRole':
      case 'Organization':
      case 'RelatedPerson':
      case 'Specimen':
      case 'CarePlan':
      case 'Goal':
      case 'Task':
      case 'FamilyMemberHistory':
      case 'Claim':
      case 'ExplanationOfBenefit':
      case 'Coverage':
      case 'Device':
      case 'Location':
        {

          const identifiers = entry.resource.identifier;
          const identifier = this.selectIdentifier(identifiers);
          if (identifier && identifier.value) {
            return identifier.value;
          }
        }
        break;
      case 'QuestionnaireResponse':
        if (entry.resource.identifier?.value) {
          return entry.resource.identifier.value;
        }
        break;
      default:
        break;
    }
  
    return undefined;
  }
  
  private selectIdentifier(identifiers: Identifier[] | undefined): Identifier | undefined {
    if (!identifiers || identifiers.length === 0) {
      return undefined;
    }
    return (
      identifiers.find((i) => i.use === 'usual') ||
      identifiers.find((i) => i.use === 'official') ||
      identifiers[0]
    );
  }

  private _onDidChangeTreeData: vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<FhirResourceTreeItem | undefined | null | void>();

  private showAOnly = true;
  private showBOnly = true;
  private showAAndB = true;

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
