import { getActiveDocument } from "./get-bundle";
import * as vscode from 'vscode';

export async function compareBundles()
{
  // Get a bundle to compare to
  const editorItems: vscode.QuickPickItem[] = vscode.workspace.textDocuments.map(document => {
    return {
        label: document.fileName,
        description: document.languageId
    };
  });

  const selectedItem = await vscode.window.showQuickPick(editorItems, {
    placeHolder: "Select a bundle to compare to"
  });

  if (!selectedItem){ return; }

  const documentB = vscode.workspace.textDocuments.find( document => document.fileName === selectedItem.label);
  if (!documentB) { return; }

  const documentA = getActiveDocument();
  if (!documentA) { return; }

  // Open a new tab with bundleA on the left, bundleB on the right
  vscode.window.showTextDocument(documentA, vscode.ViewColumn.One);
  vscode.window.showTextDocument(documentB, vscode.ViewColumn.Two);

  //await vscode.commands.executeCommand('vscode.diff', documentA.uri, documentB.uri, "FHIR Diff");
}