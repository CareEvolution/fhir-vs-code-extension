import { getBundle } from "./get-bundle";
import * as vscode from 'vscode';

export async function minifyBundle()
{
  const bundleInfo = getBundle();
  if (!bundleInfo) { return; }
  
  const minifiedBundle = JSON.stringify(bundleInfo.json);
  const document = await vscode.workspace.openTextDocument({ language: 'json', content: minifiedBundle });
  const editor = await vscode.window.showTextDocument(document);
}