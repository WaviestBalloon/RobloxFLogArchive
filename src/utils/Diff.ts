export async function generateDiff(newArray: Array<string>, oldArray: Array<string>): Promise<{diffResult: Array<string>, additions: number, removals: number}> {
	let diffResult = [];
	let additions = 0;
	let removals = 0;

	for (let i = 0; i < newArray.length; i++) {
		if (!oldArray.includes(newArray[i])) {
			console.log(newArray[i])
			diffResult.push(`+ ${newArray[i]}`);
			additions++;
		}
	}
	for (let i = 0; i < oldArray.length; i++) {
		if (!newArray.includes(oldArray[i])) {
			console.log(oldArray[i])
			diffResult.push(`- ${oldArray[i]}`);
			removals++;
		}
	}
	
	return { diffResult, additions, removals };
}
