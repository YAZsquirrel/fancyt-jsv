import { TreeItem, TreeItemCheckboxState, TreeItemCollapsibleState, Uri } from 'vscode';
import * as path from 'path';
import { INode } from './INode';
import { SchemaNode } from './SchemaNode';

export class JSONNode implements INode {
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None;
    constructor(
        private label: string,
        private path: string,
        public schema: SchemaNode
        
    ) {
        // this.command = {
        //     command: 'vscode.open',
        //     title: 'open selected',
        //     arguments: [file]
        // };
    }

    get getLabel(){
        return this.label;
    }

    get getPath()
    {
        return this.path;
    }

    get getSchema(): SchemaNode
    {
        return this.schema;
    }

    getParent(): INode | Promise<INode> {
        return this.schema;
    }
    getTreeItem(): TreeItem | Promise<TreeItem> {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
            contextValue: 'schemaProvider.tree.json',
            tooltip: this.path,
            description: 'JSON file',
            command: {
                command: 'vscode.open',
                title: 'Opens this JSON file',
                arguments: [Uri.file(this.path)]
                
            },
            checkboxState: TreeItemCheckboxState.Unchecked,

            iconPath: path.join(__dirname, "../../src/media/Json.svg")
        };
    }
    getChildren(): INode[] | Promise<INode[]> {
        return [];
    }
}


