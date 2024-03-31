/* eslint-disable curly */
import { EventEmitter, TreeItem, Event, workspace, TreeItemCollapsibleState, Uri, window, CancellationToken, CancellationError} from 'vscode';
import * as path from 'path';
import { INode } from './INode';
import * as fs from 'fs/promises';
import { JsonNode } from './JSONNode';
import ajv, { ValidateFunction } from 'ajv/dist/2019';
import { ValidationErrorsHandler } from './ValidationErrorsHandler';

export class SchemaNode implements INode {
    clearReferences() {
        this.refs.length = 0;
    }
    //static treeProvider: Dia;
    
    private jsons: JsonNode[] = [];
    private refs: SchemaNode[] = [];
    private parent: SchemaNode | null = null;
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Expanded;
    private _schemaChanged: EventEmitter<void> = new EventEmitter<void>();
    readonly schemaChanged: Event<void> = this._schemaChanged.event;

    constructor(
        private label: string,
        private path: string,
        private errorHandler?: ValidationErrorsHandler
    ) {
        this.errorHandler = errorHandler;
        if(!this.errorHandler) 
           this.errorHandler = new ValidationErrorsHandler();
        this.errorHandler.setSchema = this;
        this.schemaChanged.bind(this.errorHandler.onSchemaChange);

        this.update();
    }

    onRemove(){
        this.errorHandler?.dispose();
    }

    get getErrorHandler() {
        return this.errorHandler;
    }

    get getLabel() {
        return this.label;
    }

    get getPath() {
        return this.path;
    }

    get getUri() {
        return Uri.file(path.join(this.path));
    }

    get attachedJsons(): JsonNode[] {
        return this.jsons;
    }

    get references(): SchemaNode[]{
        return this.refs;
    }

    get Parent(): SchemaNode | null{
        return this.parent;
    }

    addReferencesByUris(uris: Uri[])
    {
        for (let uri of uris) {
            let isAttached = false;
            for (let ref of this.refs) {
                let refPath = ref.getPath;
                if (isAttached = refPath === uri.fsPath) {
                    window.showInformationMessage(`Reference at \"${uri.fsPath}\" was already attached to \"${this.label}\"!`);
                    break;
                }
            }

            if (isAttached) { continue; }
            if (this.path === uri.fsPath) {
                window.showWarningMessage(`Schema can't self reference schema: \"${this.label}\"!`);
                continue;
            }
            let ref = new SchemaNode(path.basename(uri.fsPath), uri.fsPath);
            this.refs.push(ref);
            ref.parent = this;
        }
    }

    addReferences(refs: SchemaNode[])
    {
        for (let ref of refs) {
            let isAttached = false;
            for (let newref of this.refs) {
                let path = newref.getPath;
                if (isAttached = path === ref.getPath) {
                    break;
                }
            }

            if (isAttached) { continue; }
            if (this.path === ref.getPath) {
                window.showWarningMessage(`Schema can't self reference to itself: \"${this.label}\"!`);
                continue;
            }
            ref.parent = this;
            this.refs.push(ref);
        }

    }

    addJSONsByUris(uris: Uri[]) {
        for (let uri of uris) {
            let isAttached = false;
            for (let json of this.attachedJsons) {
                let jsonPath = json.getPath;
                if (isAttached = jsonPath === uri.fsPath) {
                    window.showInformationMessage(`Json \"${uri.fsPath}\" was already attached to \"${this.label}\"!`);
                    break;
                }
            }

            if (isAttached) { continue; }
            if (this.path === uri.fsPath) {
                window.showWarningMessage(`You can't attach schema to itself: \"${this.label}\"!`);
                continue;
            }
            let json = new JsonNode(path.basename(uri.fsPath), uri.fsPath, this);
            this.attachedJsons.push(json);
        }
        this.errorHandler!.setJsons = this.jsons; 

    }

    addJSONs(jsons: JsonNode[]) {
        for (let json of jsons) {
            let isAttached = false;
            for (let ajson of this.attachedJsons) {
                let jsonPath = ajson.getPath;
                if (isAttached = jsonPath === json.getPath) {
                    break;
                }
            }

            if (isAttached) { continue; }
            if (this.path === json.getPath) {
                window.showWarningMessage(`You can't attach schema to itself: \"${this.label}\"!`);
                continue;
            }
            json.schema = this;
            this.attachedJsons.push(json);
        }
        this.errorHandler!.setJsons = this.jsons; 

    }

    changeSchema(label: string, path: string) {
        this.label = label;
        this.path = path;
        this.update();
        this.errorHandler!.setJsons = this.jsons;
        this._schemaChanged.fire(); 
    }

    async update(token?: CancellationToken | undefined): Promise<void>
    {
        if (token && token?.isCancellationRequested)
            //return Promise.reject().catch(() => console.log('update canceled'));
            throw new CancellationError();      
        this.ajv = new ajv(
            {
                allErrors : true,
                strict: true,
                verbose: true,
                inlineRefs: false
            });

        await this.loadSchema(token);
        await this.setValidate(token);
    }

    getParent(): SchemaNode | Promise<SchemaNode> | null {
        return null;
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {

        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
            contextValue: 'schemaProvider.tree.schema',
            tooltip: this.path,
            description: 'JSON Schema',
            // checkboxState: TreeItemCheckboxState.Unchecked,
            
            command: {
                command: 'vscode.open',
                title: 'Opens this JSON file',
                arguments: [Uri.file(this.path)]
            },
            iconPath: Uri.file(path.join(__dirname, '../images/media/Schema.svg'))
        };
    }

    getChildrenJsons(): JsonNode[] | Promise<JsonNode[]> {
        return this.jsons;
    }

    getChildrenSchemas(): SchemaNode[] | Promise<SchemaNode[]> {
        return this.refs;
    }

    getAllChildrenArray(array? : SchemaNode[]): SchemaNode[]
    {
        if (!array) array = [];
        
        if (this.refs.length === 0) 
            return array;
        
        array = [...array, ...this.refs ];
        
        this.refs.forEach(ref => array = ref.getAllChildrenArray(array));
        return array;
    }

    ajv:ajv = new ajv(
        {
            allErrors : true,
            strict: true,
            verbose: true,
            inlineRefs: false
        });
 
    private schema: any;
    private validate: ValidateFunction | undefined;

    async setValidate(token: CancellationToken | undefined) : Promise<void>
    {
        if (!this.schema) {return;}
        
        try {
            let schemaValidationResult = 
                await this.ajv
                    .addSchema([...new Set(this.getAllChildrenArray().flat())].map(x => x.schema))
                    .validateSchema(this.schema, false);

            if (token && token?.isCancellationRequested)
                //return Promise.reject().catch(() => console.log('schema validation canceled'));
                throw new CancellationError();

            let errors = this.ajv.errors;
            await this.errorHandler!.handleSchemaErrors(errors, token);
            
            if (!schemaValidationResult)
            {
                return;
            }
            
            this.validate = this.ajv.compile(this.schema);

            if (!this.validate) {throw new Error(`Schema's validate function was invalid \(${this.getLabel}\)`);}
                
        } catch (ex ) {
            if (ex instanceof CancellationError) 
                throw ex;
            else if (ex instanceof Error)
            {
                let message = (ex as Error).message;

                // errorHandler.handleStrictErrors(message);
                if (message.startsWith('strict mode:', 0))
                {
                    message = message.slice('strict mode:'.length + 1, message.indexOf('(strictTypes)'));
                }

                window.showErrorMessage(`Error \'${message}\' occured when tried to validate schema \'${this.label}\'.`);
            }
        }
    }

    async loadSchema(token: CancellationToken | undefined): Promise<void>
    {
        try {
                      
            let content = await fs.readFile(this.getPath);
            let text = workspace.textDocuments.find(x => x.uri.fsPath === this.getPath)?.getText() ?? content.toString();

            if (token && token?.isCancellationRequested)
                //return Promise.reject().catch(() => console.log('load canceled'));
                throw new CancellationError();

            this.schema = JSON.parse(text);
            delete this.schema['$schema'];
        }
        catch (ex) {
            if (ex instanceof CancellationError) throw ex;
            else if (ex instanceof Error)
            {
                window.showErrorMessage(`Error \'${ex.message}\' occured when tried to parse schema \'${this.label}\'.`);
                throw ex;
            }
        }
    }

    async validateJson(jsonnode: JsonNode, token: CancellationToken | undefined): Promise<void>
    {
        try 
        { 
            
            if (!this.validate) 
            {
                await this.update(token);
            }
            if (token && token?.isCancellationRequested)
                //return Promise.reject().catch(() => console.log('validate json inside canceled'));
                throw new CancellationError();

            let result = this.validate!(jsonnode.getJson);
            await this.errorHandler!.handleJsonErrors(jsonnode, this.validate!.errors, token);

            if (result) {
                console.log(`\'${jsonnode.getLabel}\' is valid against \'${this.label}\'`);
            }
        }
        catch (ex) {
            if (ex instanceof CancellationError) throw ex;
            else if (ex instanceof Error){
                window.showErrorMessage(`Error \'${(ex as Error).message}\'
                    occured when tried to validate \'${jsonnode.getLabel}\' against schema \'${this.label}\'.`);
                throw ex;
            }
        }
    }
    
    async validateOne(json: JsonNode, token: CancellationToken | undefined): Promise<void>
    {
        if (token && token?.isCancellationRequested)
            //return Promise.reject().catch(() => console.log('validate json canceled'));
            throw new CancellationError();

        await this.validateJson(json, token);
    }

    async validateAll(): Promise<void>{
        this.attachedJsons.forEach(async x => await this.validateJson(x, undefined));
    }
}