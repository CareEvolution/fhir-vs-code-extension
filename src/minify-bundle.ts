import { getBundle } from "./get-bundle";
import * as vscode from 'vscode';

export function minifyBundle()
{
  const bundleInfo = getBundle();
  if (!bundleInfo) { return; }
  
  const minifiedBundle = JSON.stringify(bundleInfo.json);

  const uri = vscode.Uri.parse('untitled:' + 'untitled-' + Math.random() + '.json');
  vscode.workspace.openTextDocument(uri).then((document) => {
      vscode.window.showTextDocument(document).then((editor) => {
          editor.edit(editBuilder => {
              editBuilder.insert(new vscode.Position(0, 0), minifiedBundle); 
          });
      });
  });
}