import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DeploymentCDNURL = "https://roblox-setup.cachefly.net/channel/";

export default async function download(versionHash: string, channel: string, axiosInstance: any, tempDirectory: string) {
	console.log(`Downloading ${DeploymentCDNURL}${channel}/${versionHash}-RobloxApp.zip...`)
	const appZipDownload = await axiosInstance.get(`${DeploymentCDNURL}${channel}/${versionHash}-RobloxApp.zip`, {
		responseType: "arraybuffer"
	}).catch((err: any) => {
		console.warn(`Failed to download ${DeploymentCDNURL}${channel}/${versionHash}-RobloxApp.zip!`);
		console.warn(Buffer.from(err.response.data).toString());
	});
	
	if (!appZipDownload?.data) return;

	writeFileSync(`${tempDirectory}/${versionHash}-RobloxApp.zip`, appZipDownload.data);
	return join(tempDirectory, `${versionHash}-RobloxApp.zip`);
}
