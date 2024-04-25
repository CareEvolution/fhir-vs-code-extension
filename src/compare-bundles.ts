import { getActiveDocument, getBundleFromDocument } from "./get-bundle";
import * as vscode from 'vscode';

export async function compareBundles()
{
  const getJustTheFileName = (filePath: string) => {
    return filePath.split('\\')?.pop()?.split('/').pop();
  };

  // Get a bundle to compare to
  const editorItems: vscode.QuickPickItem[] = vscode.workspace.textDocuments.map(document => {
    const justTheFileName = getJustTheFileName(document.fileName);
    return {
        label: justTheFileName || '',
        description: document.fileName
    };
  });

  const selectedItem = await vscode.window.showQuickPick(editorItems, {
    placeHolder: "Select a bundle to compare to"
  });

  if (!selectedItem){ return; }

  const documentB = vscode.workspace.textDocuments.find( document => document.fileName === selectedItem.description);
  if (!documentB) { return; }

  const documentA = getActiveDocument();
  if (!documentA) { return; }

  await openBundleInWindow(documentA, getJustTheFileName(documentA.fileName) || '', vscode.ViewColumn.One);
  await openBundleInWindow(documentB, selectedItem.label, vscode.ViewColumn.Two);
}

async function openBundleInWindow(document: vscode.TextDocument, fileName: string, column: vscode.ViewColumn) {
  const bundle = getBundleFromDocument(document);

  const replacer = (key: string, value: any) =>
    value instanceof Object && !(value instanceof Array) ? 
        Object.keys(value)
        .sort()
        .reduce((sorted: {[id: string]: any}, key) => {
            sorted[key] = value[key];
            return sorted;
        }, {}) :
        value;
    
    const orderedBundle = JSON.stringify(bundle?.json, replacer);

    const uri = vscode.Uri.parse('untitled:' + fileName);
    const newDocument = await vscode.workspace.openTextDocument(uri);

    const editor = await vscode.window.showTextDocument(newDocument, column);
    await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(0, 0), orderedBundle); 
    });
    await vscode.commands.executeCommand('editor.action.formatDocument');

    const topPosition = new vscode.Position(0, 0);
    editor.revealRange(new vscode.Range(topPosition, topPosition));

}

