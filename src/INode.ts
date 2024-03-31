
import { TreeItem } from "vscode";
import { SchemaNode } from "./SchemaNode";
import { JsonNode } from "./JSONNode";
export interface INode
{
    getTreeItem(): Promise<TreeItem> | TreeItem;
    getChildrenJsons(): Promise<JsonNode[]> | JsonNode[];
    getChildrenSchemas(): Promise<SchemaNode[]> | SchemaNode[];
    getParent(): Promise<SchemaNode> | SchemaNode | null;
} 
