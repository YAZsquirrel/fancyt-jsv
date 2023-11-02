import { TreeItem } from "vscode";
export interface INode
{
    getTreeItem(): Promise<TreeItem> | TreeItem;
    getChildren(): Promise<INode[]> | INode[];
    getParent(): Promise<INode> | INode | null;
} 
