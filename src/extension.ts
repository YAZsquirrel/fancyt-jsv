'use strict';

import { ExtensionContext, commands, window } from 'vscode';
import { SchemaTreeProvider } from './SchemaTreeProvider';
import { INode } from './INode';
import { JSONNode } from './JSONNode';
import { SchemaNode } from './SchemaNode';

export function activate(context: ExtensionContext) {
	let provider = new SchemaTreeProvider(context);  
	let treeView = window.createTreeView('schemaProvider', {
		'treeDataProvider' : provider,
		'canSelectMany' : true,
		'dragAndDropController' : provider,
		'showCollapseAll' : true,
		'manageCheckboxStateManually': false,
	});
	

	let disposables = [
		treeView,
		
		// gui
		commands.registerCommand('schemaProvider.addSchemas', async () => await provider.addSchemas()),
		commands.registerCommand('schemaProvider.addJSONs', async () => await provider.addJSONsToSchema()),
		commands.registerCommand('schemaProvider.addJSONsOnButton', async (schema: SchemaNode) => await provider.addJSONs(schema)),
		commands.registerCommand('schemaProvider.removeNode', (node: INode) => provider.removeNode(node)),
		commands.registerCommand('schemaProvider.changeSchema', async () => await provider.changeSchema()),
		commands.registerCommand('schemaProvider.changeSchemaOnRMB', async (schema: SchemaNode) => await provider.changeSchemaToAnother(schema)),
		
		// Settings
		commands.registerCommand('schemaProvider.setValidateOnChange', () => provider.setIfToValidateOnChange()),
		commands.registerCommand('schemaProvider.setValidateMarkedOrAll', async () => await provider.setIfToValidateMarkedOrAll()),

		// Validation commands
		commands.registerCommand('schemaProvider.validateOne', async (node: JSONNode) => await provider.validateOne(node)),
		commands.registerCommand('schemaProvider.validateAll', async () => await provider.validateAll()),
		commands.registerCommand('schemaProvider.validateAllAttached', async (schema: SchemaNode) => await provider.validateAllInSchema(schema)),
	];

	context.subscriptions.push(...disposables);

}
export function deactivate() {}




