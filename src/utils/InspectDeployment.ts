import { execSync } from "node:child_process";
import { join } from "node:path";

export async function gatherFLogs(directoryToUnzipped: string): Promise<Array<string>> {
	const playerExecutable = join(directoryToUnzipped, "RobloxPlayerBeta.exe");
	console.log(`Inspecting and extracting FLogs from ${directoryToUnzipped}`);
	
	let output = execSync(`strings ${playerExecutable} | grep FLog::`, { encoding: "utf-8" });
	let flogs = output.split("\n").slice(0, -1); // Remove the last element because it's always a empty string

	for (let i = 0; i < flogs.length; i++) {
		let flog = flogs[i];
		
		if (flog.includes("[FLog::")) {
			flog = flog.slice(flog.indexOf("[FLog::"));
			flogs[i] = flog;
		} else if (flog.includes("[DFLog::")) {
			flog = flog.slice(flog.indexOf("[DFLog::"));
			flogs[i] = flog;
		} else {
			throw new Error(`Could not determine Log type: ${flog}`);
		}
	}

	return flogs
}
