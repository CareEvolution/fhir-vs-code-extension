import { BundleEntry, FhirResource } from "fhir/r4";
import { getActiveDocument, getBundleFromDocument } from "./get-bundle";
import * as vscode from 'vscode';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

export async function compareBundles(context: vscode.ExtensionContext)
{
  // Get a bundle to compare to - we offer up files in the open tabs
  const tabGroups = vscode.window.tabGroups;
  const editorItems: vscode.QuickPickItem[] = [];
  tabGroups.all.forEach(tg => {
    tg.tabs.forEach( t => {
      const textDoc = t.input as vscode.TabInputText;
      if (textDoc && t.label !== vscode.window.tabGroups.activeTabGroup.activeTab?.label) {
        editorItems.push( {
          label: t.label,
          description: textDoc.uri.toString()
        });
      }
    });
  });

  const selectedItem = await vscode.window.showQuickPick(editorItems, {
    placeHolder: 'Select a bundle to compare to'
  });

  if (!selectedItem){ return; }

  const documentB = await vscode.workspace.openTextDocument(vscode.Uri.parse(selectedItem.description ?? ''));
  if (!documentB) { return; }

  const documentA = getActiveDocument();
  if (!documentA) { return; }

  // I'm reworking each document so that the resources and their properties are alphabetized.
  const orderedBundleA = createComparableBundle(documentA);
  const orderedBundleB = createComparableBundle(documentB);

  if (!orderedBundleA || !orderedBundleB) {
    vscode.window.showInformationMessage('Unable to compare these 2 files');
    return;
  }

  // And then I'm opening them in side-by-side windows that scroll independently.
  await displayBundles(orderedBundleA!, path.parse(documentA.fileName).base || '', orderedBundleB!, selectedItem.label, context);
}

function createComparableBundle(document: vscode.TextDocument): string | undefined {
  const bundle = getBundleFromDocument(document);
  if (!bundle) { return; }

  // Sort the bundle entries by resource type
  bundle?.json.entry?.sort((a: BundleEntry<FhirResource>, b: BundleEntry<FhirResource>) => {
    const aResourceType = a.resource?.resourceType;
    const bResourceType = b.resource?.resourceType;
    if (!aResourceType && !bResourceType) { return 0; }
    if (!aResourceType) { return -1; }
    if (!bResourceType) { return 1; }
    return aResourceType.localeCompare(bResourceType);
  });

  // Alphabetize the order of the properties for each json object in the bundle
  const replacer = (key: string, value: any) =>
    value instanceof Object && !(value instanceof Array)
    ? sortFhirProperties(value) 
    : value;

  const orderedBundle = JSON.stringify(bundle?.json, replacer);

  // Format the bundle - the tab width is important because we use it when getting line
  // numbers for the resources
  const formattedBundle = JSON.stringify(JSON.parse(orderedBundle), null, 2);

  return formattedBundle;
}

function sortFhirProperties(value: any): { [id: string]: any} {

  let keys = Object.keys(value).sort();

  const idIndex = keys.indexOf('id');
  if (idIndex > -1) {
    const idItem = keys.splice(idIndex, 1);
    keys.splice(0, 0, idItem[0]);
  }

  const resourceTypeIndex = keys.indexOf('resourceType');
  if (resourceTypeIndex > -1) {
    const idItem = keys.splice(resourceTypeIndex, 1);
    keys.splice(0, 0, idItem[0]);
  }

  return keys.reduce((sorted: { [id: string]: any }, key) => {
    sorted[key] = value[key];
    return sorted;
  }, {});
}

async function displayBundles(bundleA: string, fileNameA: string, bundleB: string, fileNameB: string, context: vscode.ExtensionContext) {

  const tempFileA = tmp.fileSync({ prefix: path.parse(fileNameA).name, postfix: '.json' });
  fs.writeFileSync(tempFileA.name, bundleA);

  const tempFileB = tmp.fileSync({ prefix: path.parse(fileNameB).name, postfix: '.json'  });
  fs.writeFileSync(tempFileB.name, bundleB);

  const newDocumentA = await vscode.workspace.openTextDocument(tempFileA.name);
  const editorA = await vscode.window.showTextDocument(newDocumentA, vscode.ViewColumn.One);

  const newDocumentB = await vscode.workspace.openTextDocument(tempFileB.name);
  const editorB = await vscode.window.showTextDocument(newDocumentB, vscode.ViewColumn.Two);


  // await editor.edit(editBuilder => {
  //   editBuilder.insert(new vscode.Position(0, 0), bundleA);
  // });
  // await vscode.commands.executeCommand('editor.action.formatDocument');
  // const topPosition = new vscode.Position(0, 0);
  // editor.revealRange(new vscode.Range(topPosition, topPosition));


  // The splitEditorInGroup command is promising, but it displays the same document in both editors
  // await vscode.commands.executeCommand('workbench.action.splitEditorInGroup');

  // const editor2 = vscode.window.visibleTextEditors[1];

  // const document = editor.document;
  // const entireRange = new vscode.Range(
  //     new vscode.Position(0, 0),
  //     new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
  // );
  // await editor2.edit(editBuilder => {
  //     editBuilder.delete(entireRange);
  //     editBuilder.insert(new vscode.Position(0, 0), bundleB);
  // });
  // await vscode.commands.executeCommand('editor.action.formatDocument');
  // editor2.revealRange(new vscode.Range(topPosition, topPosition));

  // To use the built-in diff command, let's store the two files in a temp directory and then open them in the diff window
  // Create a temporary file



  // const leftDocumentUri = vscode.Uri.file(tempFileA.name);
  // const rightDocumentUri = vscode.Uri.file(tempFileB.name);

  // The vscode.diff command is interesting, but I can't scroll the two halves independently, and the diff of course
  // doesn't know which resources are equivalent between A and B, so the overall effect is confusing.
  //await vscode.commands.executeCommand('vscode.diff', leftDocumentUri, rightDocumentUri, fileNameA + ' <-> ' + fileNameB );

}

