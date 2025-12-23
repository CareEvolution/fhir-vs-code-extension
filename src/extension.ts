import * as vscode from 'vscode';
import { minifyBundle } from './minify-bundle';
import { BundleResourcesTreeProvider } from './create-bundle-tree';
import { compareBundles } from './compare-bundles';

export function activate(context: vscode.ExtensionContext) {

  console.log('Extension "fhir-toolkit-extension" is now active!');

  // Register commands
  const minifyCommand = vscode.commands.registerCommand('fhir-toolkit-extension.minifyBundle', minifyBundle);
  context.subscriptions.push(minifyCommand);

  const compareWithCommand = vscode.commands.registerCommand('fhir-toolkit-extension.compareWith', compareBundles);
  context.subscriptions.push(compareWithCommand);

  // Register tree data provider
  const bundleResourcesTreeProvider = new BundleResourcesTreeProvider();
  vscode.window.registerTreeDataProvider(
    'fhirResources',
    bundleResourcesTreeProvider
  );
}

export function deactivate() {}
