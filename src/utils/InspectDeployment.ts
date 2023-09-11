import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function gatherFLogs(directoryToUnzipped: string): Promise<Array<string>> {
	const playerExecutable = join(directoryToUnzipped, "RobloxPlayerBeta.exe");
	console.log(`Inspecting and extracting FLogs from ${directoryToUnzipped}`);
	
	let output = execSync(`strings ${playerExecutable} | grep FLog::Output`, { encoding: "utf-8" });
	let flogs = output.split("\n").slice(0, -1); // Remove the last element because it's always a empty string

	return flogs
}
