/* eslint-disable curly */
/* eslint-disable @typescript-eslint/naming-convention */
import { TreeDataProvider, window,  TreeItem, CancellationToken, Event, ProviderResult, TreeDragAndDropController, DataTransfer, EventEmitter, ExtensionContext, Uri } from 'vscode'; 

import { INode } from './INode';
import {JsonNode} from './JSONNode';
import { SchemaNode } from './SchemaNode';
import * as path from 'path';
import { ValidationErrorsHandler } from './ValidationErrorsHandler';
import { SchemaRefTreeProvider } from './SchemaRefTreeProvider';

export class SchemaTreeProvider implements TreeDataProvider<INode>, TreeDragAndDropController<INode>
{
    RefTree: SchemaRefTreeProvider;

    constructor (private context: ExtensionContext) { 

        this.RefTree = new SchemaRefTreeProvider(context, this);
        this.restoreSettings();  
        ValidationErrorsHandler.setContext = this.context;

    }
    
    private async restoreSettings()
    {
        let whichValidate = await this.context?.secrets.get('validateMarkedOrAll');
        if (whichValidate)
        {   
            let which: number | undefined = parseInt(whichValidate); 

            if (which)
            {
                this.settings.validateMarkedOrAll = which;
            }
        }
        
        {
            let validateOnChange = await this.context?.secrets.get('validateOnChange');
            ValidationErrorsHandler.validateOnChange = validateOnChange === 'true';
        }

        {
            let savedTree = await this.context?.secrets.get('savedTree');
            
            if (!savedTree) 
                return;

            this.tree = JSON.parse(savedTree);

            console.log(this.tree);

            let schemas = this.tree.map(x => Uri.file(path.join(x.path)));
            this.addSchemasByUri(schemas!);
            
            this.tree?.forEach(async x => {
                if (x.jsonList)
                {
                    let jsons = x.jsonList?.map(json => Uri.file(path.join(json)));
                    this.schemas.find(s => s.getPath === x.path)?.addJSONsByUris(jsons);
                }
                if (x.refList)
                {
                    let refs = x.refList?.map(ref => Uri.file(path.join(ref)));
                    this.schemas.find(s => s.getPath === x.path)?.addReferencesByUris(refs);
                }
            });
            
        }
        this.RefTree.refresh();
    }
    
    tree: TreeRoot[] = [];

    saveTree(){
        this.context?.secrets.store('savedTree', JSON.stringify(this.tree));
    }

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
        return Promise.resolve(element ? element.getChildrenJsons() : this.schemas);
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
        
        let paths: TreeRoot[] = uris.map((x): TreeRoot => {return {path: x.fsPath, refList: [], jsonList: []};})
                                    .filter(x => !this.tree.find(t => t.path === x.path), this);
        
        this.tree?.push(...paths);
        this.saveTree();
        this.addSchemasByUri(uris);
    }

    private addSchemasByUri(uris: Uri[]) {
        for (let uri of uris) {
            let isAdded = false;
            for (let schema of this.schemas) {
                let schemaPath = schema.getPath;
                if (isAdded = schemaPath === uri.fsPath) {
                    window.showInformationMessage(`Schema \"${uri.fsPath}\" was already added!`);
                    break;
                }
            }

            if (isAdded) { continue; }

            let errorHandler = new ValidationErrorsHandler();
            

            let schema = new SchemaNode(path.basename(uri.fsPath), uri.fsPath, errorHandler);
            this.schemas.push(schema);
        }
        this._onDidChangeTreeData.fire();
    }

	async validateAllInSchema(schema: SchemaNode) 
    {
        schema.validateAll();
	}

    validateAll(): void 
    {
        this.schemas.forEach(async x => await x.validateAll());
	}

    async validateOne(json: JsonNode): Promise<void> 
    {
        await json.validate();
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

        let idx = this.tree.findIndex(x => x.path === schema.getPath);

        let exist: boolean = false;

        for (let schema2 of this.schemas)
        {         
            let schemaPath = schema2.getPath;
            if (exist = schemaPath === uri[0].fsPath) 
            {
                let result = await window.showWarningMessage(
                    `Schema \"${uri[0].fsPath}\" is already in the tree! Do you want to move JSONs from \'${schema.getPath}\' to \'${uri[0].fsPath}\' and remove \'${schema.getPath}\'?`, 
                    "Yes", "No"); 

                let idx2 = this.tree?.findIndex(x => x.path === schemaPath);
                
                if (result === 'Yes')
                {
                    schema2.addJSONs(schema.attachedJsons);

                    if (idx2)
                    {
                        let jsons = schema.attachedJsons
                                        .map(x => x.getPath)
                                        .filter(x => !this.tree[idx].jsonList.find(t => t === x) 
                                                  && !(this.tree[idx].path === x), this);
                        this.tree[idx2].jsonList.push(...jsons);
                    }

                    this.removeNode(schema);
                    this._onDidChangeTreeData.fire();
                }

                this.tree.splice(idx!, 1);

                return;
            }
        }

        if (!exist)
        {
            schema.changeSchema(path.basename(uri[0].fsPath), uri[0].fsPath);
            schema.clearReferences();
            if (idx)
            {
                this.tree[idx].path = uri[0].fsPath;
            }    
        }
        this.saveTree();
        this._onDidChangeTreeData.fire();
                
    }

    removeNode(node: INode)
    {
        if (node instanceof SchemaNode)
        {
            let index = this.schemas.indexOf(node);
            let idx = this.tree.findIndex(x => x.path === node.getPath);

            if (index > -1) 
            {
                this.schemas[index].onRemove();
                this.schemas.splice(index, 1);
                this.tree.splice(idx!, 1);
            }   
            node!.getErrorHandler!.clearErrors();
            this._onDidChangeTreeData.fire();
        }
        else if (node instanceof JsonNode)
        {
            let json = node as JsonNode;
            let index = json.getSchema.attachedJsons.indexOf(json);
            json.getSchema.getErrorHandler!.clearJsonErrors(json.getUri);

            let schema_idx = this.tree.findIndex(x => x.path === json.getSchema.getPath);
            
            let idx = this.tree[schema_idx!].jsonList.findIndex(x => x === node.getPath);

            if (index > -1) 
            {
                json.getSchema.attachedJsons.splice(index, 1);
                this.tree[schema_idx!].jsonList.splice(idx!, 1);
            }
            this._onDidChangeTreeData.fire();
        }
        else 
        {
            throw new Error('Trying to remove nothing');
        }
        this.saveTree();
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

        let schema_idx = this.tree.findIndex(x => x.path === schema.getPath);

        let paths = uris.map(x => x.fsPath)
                        .filter(x => !this.tree[schema_idx].jsonList.find(t => t === x) 
                                     && !(this.tree[schema_idx].path === x), this);
        this.tree[schema_idx!].jsonList.push(...paths);

        schema.addJSONsByUris(uris);

        this.saveTree();
        this._onDidChangeTreeData.fire();
    }

    private settings: STPSettings =
    {
        validateOnChange: true,
        validateMarkedOrAll: WhichValidate.All
    };

    setIfToValidateOnChange()
    {
        ValidationErrorsHandler.validateOnChange = this.settings.validateOnChange = !this.settings.validateOnChange;
        this.context?.secrets.store('validateOnChange', this.settings.validateOnChange.toString());
        window.showInformationMessage(`Validation ${ this.settings.validateOnChange ? 'will' : 'won\'t'} occur on edit`);

    }

    async setIfToValidateMarkedOrAll()
    {
        let labels = ['Marked', 'All', 'Only (attached) JSONs'];

        let label = await window.showQuickPick(labels, 
            {
                'canPickMany' : false, 
                'ignoreFocusOut' : true, 
                'title': `Choose which file should be validated (Now is: ${labels[this.settings.validateMarkedOrAll]})`
            });
    
        if (!label) {return;}
    
        let index = labels.indexOf(label);

        switch(index)
        {
            case 0: 
                this.settings.validateMarkedOrAll = WhichValidate.Marked;
                break;
            case 1: this.settings.validateMarkedOrAll = WhichValidate.All;
                break;
            case 2: this.settings.validateMarkedOrAll = WhichValidate.OnlyJsons;
                break;
             
        }
        this.context?.secrets.store('validateMarkedOrAll', this.settings.validateMarkedOrAll.toString());
        
        
    }
}

enum WhichValidate {
    Marked,
    All,
    OnlyJsons
}

type STPSettings = {
    validateOnChange: boolean,
    validateMarkedOrAll: WhichValidate,
    
};

export type TreeRoot = {
    path: string,
    refList: string[],
    jsonList: string[]
};

