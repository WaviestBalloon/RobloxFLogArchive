import fastify, { FastifyReply, FastifyRequest } from "fastify";
import axios from "axios";
import download from "./utils/DownloadDeployment.js";
import { extractArchive, gatherFLogs } from "./utils/InspectDeployment.js";
import humanFileSize from "./utils/Filesize.js";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!existsSync("data")) { mkdirSync("data"); }
if (!existsSync("temp")) { mkdirSync("temp"); }
let configurationJson = JSON.parse(readFileSync(join(__dirname, "..", "config.json"), "utf-8"));

const server = fastify({ logger: true });
const axiosInstance = axios.create({
	headers: {
		"User-Agent": "Roblox FLog Archive Program - https://github.com/WaviestBalloon/RobloxFLogArchive" // Let's be nice and tell Roblox who we are :3
	}
});
const deploymentTempDirectory = join(__dirname, "..", "temp");

server.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
	reply.send("Send a GET request to /api/info to get information about the archive.");
});
server.get("/api/getarchive/:channel/:version", async (request: FastifyRequest, reply: FastifyReply) => {
	//@ts-ignore
	if (!configurationJson.channelsToCheck.includes(request.params?.channel)) {
		reply.code(404).send("Channel not found.");
	} else {
		//@ts-ignore
		if (!existsSync(join(__dirname, "..", "data", request.params?.channel, `${request.params?.version}.json`))) {
			reply.code(404).send("Version not found.");
		} else {
			//@ts-ignore
			reply.send(JSON.parse(readFileSync(join(__dirname, "..", "data", request.params?.channel, `${request.params?.version}.json`), "utf-8")));
		}
	}
});
async function getArchiveStats(hostname: string) {
	let totalSize = 0;
	let versionFiles = 0;
	let flogArchives: any = {};
	readdirSync(join(__dirname, "..", "data")).forEach(async (channel) => {
		readdirSync(join(__dirname, "..", "data", channel)).forEach(async (version) => {
			version = join(__dirname, "..", "data", channel, version);
			if (version.endsWith(".json")) {
				console.log(`Found version ${version.split("/")[version.split("/").length - 1].split(".")[0]} in channel ${channel}...`);
				totalSize += statSync(version).size;
				versionFiles += 1;
				flogArchives[channel] = {
					...flogArchives[channel],
					[version.split("/")[version.split("/").length - 1].split(".")[0]]: {
						timestamp: JSON.parse(readFileSync(version, "utf-8")).timestamp,
						size: statSync(version).size,
						viewUrl: `https://${hostname}/api/getarchive/${channel}/${version.split("/")[version.split("/").length - 1].split(".")[0]}`
					}
				};
			}
		});
	});

	return { totalSize, versionFiles, flogArchives };
}
server.get("/api/info", async (request: FastifyRequest, reply: FastifyReply) => {
	const { totalSize, versionFiles, flogArchives } = await getArchiveStats(request.hostname);

	reply.send({
		uptime: process.uptime(),
		channelsTracked: configurationJson.channelsToCheck,
		versionsCurrentlyArchived: versionFiles,
		archiveDataSize: {
			bytes: totalSize,
			humanReadable: await humanFileSize(totalSize)
		},
		versionsAvailableInArchive: flogArchives
	});
});

server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
	if (err) throw err;
	console.log(`Server listening on ${address}`);
});

async function checkVersion() {
	console.log("Checking versions...");

	for (const channel of configurationJson.channelsToCheck) {
		const latestVersionOnChannel = await axiosInstance.get(`https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/${channel}`);
		console.log(`Latest version on channel ${channel} is ${latestVersionOnChannel.data.clientVersionUpload}`);

		if (!existsSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`))) {
			const location = await download(latestVersionOnChannel.data.clientVersionUpload, channel, axiosInstance, deploymentTempDirectory);
			console.log(`Downloaded version ${latestVersionOnChannel.data.clientVersionUpload} to ${location}...`);
			
			const extractionLocation = await extractArchive(location, deploymentTempDirectory);
			console.log(`Extracted version ${latestVersionOnChannel.data.clientVersionUpload} to ${extractionLocation}...`);
			
			const flogs = await gatherFLogs(extractionLocation);
			console.log(`Gathered FLogs for version ${latestVersionOnChannel.data.clientVersionUpload} to ${join(__dirname, "..", "data", "flogs", latestVersionOnChannel.data.clientVersionUpload)}...`);

			if (!existsSync(join(__dirname, "..", "data", channel))) {
				mkdirSync(join(__dirname, "..", "data", channel));
			}
			writeFileSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`), JSON.stringify({
				rbxResponse: {
					version: latestVersionOnChannel.data.version,
					clientVersionUpload: latestVersionOnChannel.data.clientVersionUpload,
					bootstrapperVersion: latestVersionOnChannel.data.bootstrapperVersion,
				},
				timestamp: Date.now(),
				flogs: flogs
			}));

			console.log("Cleaning up temporary file...");
			rmSync(extractionLocation, { recursive: true });
		} else {
			console.log(`Version ${latestVersionOnChannel.data.clientVersionUpload} has already been archived, no changes...`);
		}
	}
}
checkVersion();
console.log("Starting version check interval...");
setInterval(checkVersion, 150000); // Every 2.5 minutes
