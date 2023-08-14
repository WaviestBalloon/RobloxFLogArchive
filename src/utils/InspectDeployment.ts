import { unlinkSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function extractArchive(zipPath: string, tempDirectory: string) {
	const id = Date.now();
	console.log(`Extracting ${zipPath}`);
	mkdirSync(join(zipPath, "..", `temp-${id}`), { recursive: true });
	console.log(zipPath)
	execSync(`unzip -o ${zipPath} -d ${join(zipPath, "..", `temp-${id}`)}`);
	console.log(`Removing ${zipPath}`);
	unlinkSync(zipPath);

	return join(tempDirectory, `temp-${id}`);
}

export async function gatherFLogs(directoryToUnzipped: string) {
	const playerExecutable = join(directoryToUnzipped, "RobloxPlayerBeta.exe");
	let flogs = {};
	console.log(`Inspecting and extracting FLogs from ${directoryToUnzipped}`);
	
	let output = execSync(`strings ${playerExecutable} | grep FLog::Output`, { encoding: "utf-8" });
	flogs = output.split("\n").slice(0, -1); // Remove the last element because it's always a empty string

	return flogs
}
