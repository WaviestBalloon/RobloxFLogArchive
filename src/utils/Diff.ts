import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateDiff(newArray: Array<string>, oldArray: Array<string>): Promise<Array<string>> {
	let diffResult = [];
	for (let i = 0; i < newArray.length; i++) {
		if (!oldArray.includes(newArray[i])) {
			console.log(newArray[i])
			diffResult.push(`+ ${newArray[i].replace("[FLog::Output] ", "")}`);
		}
	}
	for (let i = 0; i < oldArray.length; i++) {
		if (!newArray.includes(oldArray[i])) {
			console.log(oldArray[i])
			diffResult.push(`- ${oldArray[i].replace("[FLog::Output] ", "")}`);
		}
	}
	
	return diffResult;
}
