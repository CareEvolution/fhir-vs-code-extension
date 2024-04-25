import { getBundle, getBundleFromDocument } from "./get-bundle";
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

  const bundleA = getBundle();
  const bundleB = getBundleFromDocument(documentB);

  // Get the diff

  // Open a new tab with bundleA on the left, bundleB on the right

  const selectedEditor = vscode.window.visibleTextEditors.find(editor => editor.document.fileName === selectedItem.label);
  if (selectedEditor) {
    vscode.window.showTextDocument(selectedEditor.document);
  }

}