// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DebugSessionWatcher } from "./dump_variables";

let watcher = new DebugSessionWatcher();

function onDidStartDebugSession (session: vscode.DebugSession)
{
	watcher.setDbgSession(session);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "debug-window-dump" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let dumpVarCmd = vscode.commands.registerCommand('debug-window-dump.dumpVariables', () => (watcher.getDebugVariables()));
	let dbgStartEvent = vscode.debug.onDidStartDebugSession(onDidStartDebugSession);

    vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            return {
                onWillReceiveMessage: (e) => (watcher.onReceivedDbgMessage(e)),
            };
        }
	});

	context.subscriptions.push(dumpVarCmd);
	context.subscriptions.push(dbgStartEvent);
}

// This method is called when your extension is deactivated
export function deactivate() {}
