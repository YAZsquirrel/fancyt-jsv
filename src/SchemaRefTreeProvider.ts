/* eslint-disable curly */
/* eslint-disable @typescript-eslint/naming-convention */

import { TreeDataProvider, window,  TreeItem, CancellationToken, Event, ProviderResult, TreeDragAndDropController, DataTransfer, EventEmitter, ExtensionContext, Uri } from 'vscode'; 

import { INode } from './INode';
import { SchemaNode } from './SchemaNode';
import * as path from 'path';
import { ValidationErrorsHandler } from './ValidationErrorsHandler';
import {SchemaTreeProvider, TreeRoot} from './SchemaTreeProvider';

export class SchemaRefTreeProvider implements TreeDataProvider<SchemaNode>, TreeDragAndDropController<SchemaNode>
{
    schemas: SchemaNode[] = [];
    private _onDidChangeTreeData: EventEmitter<SchemaNode | undefined | void> = new EventEmitter<SchemaNode | undefined | void>();
	readonly onDidChangeTreeData: Event<SchemaNode | undefined | void> = this._onDidChangeTreeData.event;

	async removeReference(node: SchemaNode)  
    {
        let parent = node.Parent;
        if (!parent)
        {
            window.showWarningMessage("You cannot remove the root in the reference tree. If you want do remove it, remove the corresponding schema in the schema tree");
            return;
        }

        let idx : number | undefined = parent?.references.findIndex(x => x === node);
        
        parent?.references.splice(idx!, 1);

        let root = this.schemaTreeProv.tree.find(x => x.path === parent?.getPath);
        idx = root?.refList.findIndex(x => x === node.getPath);
        root?.refList.splice(idx!, 1);
        this.schemaTreeProv.saveTree();
        
        this._onDidChangeTreeData.fire();
    }

    async addRefsToSchema(): Promise<void>
    {
        let labels = this.schemas.map((x, a, b) => x.getLabel);
        //this.schemas.forEach(x => labels.push(x.getLabel));

        let label = await window.showQuickPick(labels, 
        {
            'canPickMany' : false, 
            'ignoreFocusOut' : true, 
            'title': 'Attach a JSON file to a schema'
        });

        if (!label) {return;}

        let schema = this.schemas[labels.indexOf(label)];
        this.addReferences(schema);
    }

    async addReferences(schema: SchemaNode) : Promise<void>
    {
        let uris = await window.showOpenDialog(
            {
                'title': `Choose JSON file to attach to a \'${schema.getLabel}\' schema`,
                'canSelectMany': true,
                'filters' : {
                    'JSON' : ['json'],
                    'Any' : ['*']
                }
            });
    
        if (!uris) 
        {
            window.showInformationMessage('You selected nothing!');
            return;
        }

        let schema_idx = this.schemaTreeProv.tree.findIndex(x => x.path === schema.getPath);

        if (!this.schemaTreeProv.tree[schema_idx!].refList)
            this.schemaTreeProv.tree[schema_idx!].refList = [];

        let paths = uris.map(x => x.fsPath)
                        .filter(x => !this.schemaTreeProv.tree[schema_idx].refList.find(t => t === x) 
                                  && !(this.schemaTreeProv.tree[schema_idx].path === x), this);

        this.schemaTreeProv.tree[schema_idx!].refList.push(...paths);

        schema.addReferencesByUris(uris);

        this.schemaTreeProv.saveTree();
        this._onDidChangeTreeData.fire();
    }

    dropMimeTypes = [];
    dragMimeTypes = [];

    handleDrag?(source: readonly SchemaNode[], dataTransfer: DataTransfer, token: CancellationToken): void | Thenable<void> {
        throw new Error('Method not implemented.');
    }
    handleDrop?(target: SchemaNode | undefined, dataTransfer: DataTransfer, token: CancellationToken): void | Thenable<void> {
        throw new Error('Method not implemented.');
    }
    getTreeItem(element: SchemaNode): TreeItem | Thenable<TreeItem> {
        return element.getRefTreeItem();
    }
    getChildren(element?: SchemaNode | undefined): ProviderResult<SchemaNode[]> {
        return element?.getChildrenSchemas() ?? this.schemas;
    }
    getParent?(element: SchemaNode): ProviderResult<SchemaNode> {
        return element.getParent();
    }
    refresh(){
        this._onDidChangeTreeData.fire();
    }
    constructor (private context: ExtensionContext, private schemaTreeProv: SchemaTreeProvider) {
        this.schemaTreeProv = schemaTreeProv;
        this.schemas = schemaTreeProv.schemas;
        ValidationErrorsHandler.setContext = this.context;     
    }

}