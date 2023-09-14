import { execSync } from "node:child_process";
import { join } from "node:path";

export async function gatherFLogs(directoryToUnzipped: string): Promise<Array<string>> {
	const playerExecutable = join(directoryToUnzipped, "RobloxPlayerBeta.exe");
	console.log(`Inspecting and extracting FLogs from ${directoryToUnzipped}`);
	
	let output = execSync(`strings ${playerExecutable} | grep FLog::`, { encoding: "utf-8" });
	let flogs = output.split("\n").slice(0, -1); // Remove the last element because it's always a empty string

	for (let i = 0; i < flogs.length; i++) {
		flogs[i] = flogs[i].slice(flogs[i].indexOf("[FLog::"));
	}

	return flogs
}
