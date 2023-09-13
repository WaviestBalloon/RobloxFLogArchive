import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DeploymentCDNURL = "https://setup.rbxcdn.com/";
const ChannelDeploymentCDNURL = "https://roblox-setup.cachefly.net/channel/";

export async function download(versionHash: string, channel: string, axiosInstance: any, tempDirectory: string): Promise<string> {
	let downloadURL = channel !== "LIVE" ? `${ChannelDeploymentCDNURL}${channel}/${versionHash}-RobloxApp.zip` : `${DeploymentCDNURL}${versionHash}-RobloxApp.zip`
	console.log(`Downloading ${downloadURL}...`)
	const appZipDownload = await axiosInstance.get(downloadURL, {
		responseType: "arraybuffer"
	}).catch((err: any) => {
		console.warn(`Failed to download ${downloadURL}!`);
		throw err
	});
	
	if (!appZipDownload?.data) return;

	writeFileSync(`${tempDirectory}/${versionHash}-RobloxApp.zip`, appZipDownload.data);
	return join(tempDirectory, `${versionHash}-RobloxApp.zip`);
}

export async function extractArchive(zipPath: string, tempDirectory: string): Promise<string> {
	const id = Date.now();
	console.log(`Extracting ${zipPath}`);
	mkdirSync(join(zipPath, "..", `temp-${id}`), { recursive: true });
	console.log(zipPath)
	execSync(`unzip -o ${zipPath} -d ${join(zipPath, "..", `temp-${id}`)}`);
	console.log(`Cleanup: Removing ${zipPath}`);
	unlinkSync(zipPath);

	return join(tempDirectory, `temp-${id}`);
}
