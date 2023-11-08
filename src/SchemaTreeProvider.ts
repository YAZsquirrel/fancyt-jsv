import { TreeDataProvider, window,  TreeItem, CancellationToken, Event, ProviderResult, TreeDragAndDropController, DataTransfer, EventEmitter } from 'vscode'; 

// eslint-disable-next-line @typescript-eslint/naming-convention

import { INode } from './INode';
import {JSONNode} from './JSONNode';
import { SchemaNode } from './SchemaNode';
import * as path from 'path';

export class SchemaTreeProvider implements TreeDataProvider<INode>, TreeDragAndDropController<INode>
{

    schemas: SchemaNode[] = [];
    dropMimeTypes = [];
    dragMimeTypes = [];
    handleDrag?(source: readonly INode[], dataTransfer: DataTransfer, token: CancellationToken): void | Thenable<void> {
        throw new Error('Method not implemented.');
    }
    handleDrop?(target: INode | undefined, dataTransfer: DataTransfer, token: CancellationToken): void | Thenable<void> {
        throw new Error('Method not implemented.');
    }

	private _onDidChangeTreeData: EventEmitter<INode | undefined | void> = new EventEmitter<INode | undefined | void>();
	readonly onDidChangeTreeData: Event<INode | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: INode): TreeItem | Thenable<TreeItem> 
    {
        return element.getTreeItem();
    }

    getChildren(element?: INode | undefined): ProviderResult<INode[]> 
    {
        return Promise.resolve(element ? element.getChildren() : this.schemas);
    }

    getParent?(element: INode): ProviderResult<INode> 
    {
        return element.getParent();
    }

    async addSchemas(): Promise<void>
    {
        let uris = await window.showOpenDialog(
        {
            'title': 'Open JSON Schema file',
            'canSelectMany': true,
            'filters' : {
                'JSON' : ['json', 'schema.json'],
                'Any' : []
            }
        });

        if (!uris) 
        {
            window.showInformationMessage('You selected nothing!');
            return;
        }

        for (let uri of uris)
        {
            let isAdded = false;
            for (let schema of this.schemas)
            {
                let schemaPath = schema.getPath;
                if (isAdded = schemaPath === uri.fsPath) 
                {
                    window.showInformationMessage(`Schema \"${uri.fsPath}\" was already added!`);                    
                    break;
                }
            }
            
            if (isAdded) {continue;}

            let schema = new SchemaNode(path.basename(uri.fsPath), uri.fsPath);
            this.schemas.push(schema);
        }
        this._onDidChangeTreeData.fire();
    }

	validateAllInSchema(schema: SchemaNode): void 
    {
        schema.validateAll();
	}

    validateAll(): void 
    {
        this.schemas.forEach(x => x.validateAll());
	}

    validateOne(json: JSONNode): void 
    {
        json.validate();
    }
    
    // >Schema: Change schema
    async changeSchema(): Promise<void>  
    {   
        
        if (this.schemas.length === 0) 
        {
            let action = await window.showWarningMessage('No schemas added!', 'Add schemas', 'Cancel');
            if (action === 'Add schemas')
            {
                await this.addSchemas();
            }
            return;
        }

        let labels: string[] = [];
        this.schemas.forEach(x => labels.push(x.getLabel));

        let label = await window.showQuickPick(labels, 
        {
            'canPickMany' : false, 
            'ignoreFocusOut' : true, 
            'title': 'Attach a JSON file to a schema'
        });

        if (!label) {return;}

        let schema = this.schemas[labels.indexOf(label)];
        
        await this.changeSchemaToAnother(schema);
    }

    // (rmb: schema) -> 
    async changeSchemaToAnother(schema: SchemaNode): Promise<void> 
    {
        let uri = await window.showOpenDialog(
            {
                'title': `Choose JSON schema`,
                'canSelectMany': false,
                'filters' : {
                    'JSON' : ['json', 'schema.json'],
                    'Any' : ['*']
                }
            });

        if (!uri || !uri[0]) 
        {
            window.showInformationMessage('You selected nothing!');
            return;
        }
        
        if (uri[0].fsPath === schema.getPath) { return; }

        let exist: boolean = false;

        for (let schema2 of this.schemas)
        {         
            let schemaPath = schema2.getPath;
            if (exist = schemaPath === uri[0].fsPath) 
            {
                let result = await window.showWarningMessage(
                    `Schema \"${uri[0].fsPath}\" is already in the tree! What you want to move JSONs from \'${schema.getPath}\' to \'${uri[0].fsPath}\' and remove?`, 
                    "Yes", "No");  
                
                if (result === 'Yes')
                {
                    //schema.attachedJsons.concat(schema2.attachedJsons);
                    schema2.addJSONs(schema.attachedJsons);

                    this.removeNode(schema);
                    this._onDidChangeTreeData.fire();
                }

                return;
            }
        }

        if (!exist)
        {
            schema.changeSchema(path.basename(uri[0].fsPath), uri[0].fsPath);
        }

        this._onDidChangeTreeData.fire();
                
    }

    removeNode(node: INode)
    {
        if (node instanceof SchemaNode)
        {
            let index = this.schemas.indexOf(node as SchemaNode);
            if (index > -1) 
            {
                this.schemas.splice(index, 1);
            }   
            this._onDidChangeTreeData.fire();
        }
        else if (node instanceof JSONNode)
        {
            let json = node as JSONNode;
            let index = json.getSchema.attachedJsons.indexOf(json);
            if (index > -1) 
            {
                json.getSchema.attachedJsons.splice(index, 1);
            }
            this._onDidChangeTreeData.fire();
        }
        else 
        {
            throw new Error('Trying to remove nothing');
        }
    }

    async addJSONsToSchema(): Promise<void>
    {
        if (this.schemas.length === 0) 
        {
            let action = await window.showWarningMessage('No schemas added!', 'Add schemas', 'Cancel');
            if (action === 'Add schemas')
            {
                await this.addSchemas();
            }
            return;
        }

        let labels: string[] = [];
        this.schemas.forEach(x => labels.push(x.getLabel));

        let label = await window.showQuickPick(labels, 
        {
            'canPickMany' : false, 
            'ignoreFocusOut' : true, 
            'title': 'Attach a JSON file to a schema'
        });

        if (!label) {return;}

        let schema = this.schemas[labels.indexOf(label)];
        this.addJSONs(schema);
    }

    async addJSONs(schema: SchemaNode) : Promise<void>
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
        schema.addJSONsByUris(uris);

        this._onDidChangeTreeData.fire();
    }

}


