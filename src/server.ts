import * as dotenv from "dotenv";
dotenv.config();
import fastify, { FastifyReply, FastifyRequest } from "fastify";
import axios from "axios";
import { extractArchive, download } from "./utils/Deployment.js";
import { gatherFLogs } from "./utils/InspectDeployment.js";
import { generateDiff } from "./utils/Diff.js";
import { humanFileSize } from "./utils/Filesize.js";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, rmSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!existsSync("data")) mkdirSync("data");
if (!existsSync("temp")) mkdirSync("temp");
let configurationJson = JSON.parse(readFileSync(join(__dirname, "..", "config.json"), "utf-8"));
let webhooksEnabled = false;
let hostname = configurationJson.hostname;

const server = fastify({ logger: true });
const axiosInstance = axios.create({
	headers: {
		"User-Agent": "Roblox FLog Archive Program - https://github.com/WaviestBalloon/RobloxFLogArchive" // Let's be nice and tell Roblox who we are :3
	}
});
const deploymentTempDirectory = join(__dirname, "..", "temp");

if (process.env.WEBHOOKS_ENABLED == "true" && process.env.DISCORD_WEBHOOK_URL !== undefined && process.env.ROLE_TO_PING !== undefined) {
	console.log("Discord Webhook functionality has been enabled!");
	webhooksEnabled = true;
} else if (process.env.WEBHOOKS_ENABLED) {
	console.warn("Discord Webhook functionality has been disabled due to incorrect configuration inside of your .env file!");
}

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
async function getArchiveStats() {
	let totalSize = 0;
	let versionFiles = 0;
	let flogArchives: any = {};
	readdirSync(join(__dirname, "..", "data")).forEach(async (channel) => {
		readdirSync(join(__dirname, "..", "data", channel)).forEach(async (version) => {
			version = join(__dirname, "..", "data", channel, version);
			if (version.endsWith(".json") && !version.includes("channel_archive_meta")) {
				console.log(`Found archived FLogs for ${version.split("/")[version.split("/").length - 1].split(".")[0]} in channel ${channel}...`);
				const archiveFile = JSON.parse(readFileSync(version, "utf-8"));
				totalSize += statSync(version).size;
				versionFiles += 1;
				flogArchives[channel] = {
					...flogArchives[channel],
					[version.split("/")[version.split("/").length - 1].split(".")[0]]: {
						timestamp: archiveFile.timestamp,
						size: statSync(version).size,
						hash: archiveFile.hash,
						viewUrl: `https://${hostname}/api/getarchive/${channel}/${version.split("/")[version.split("/").length - 1].split(".")[0]}`
					}
				};
			}
		});
	});

	return { totalSize, versionFiles, flogArchives };
}
server.get("/api/info", async (request: FastifyRequest, reply: FastifyReply) => {
	const { totalSize, versionFiles, flogArchives } = await getArchiveStats();

	reply.send({
		uptime: process.uptime(),
		channelsTracked: configurationJson.channelsToCheck,
		versionsCurrentlyArchived: versionFiles,
		latestArchival: `https://${hostname}/api/getarchive/${configurationJson.latestArchival}`,
		archiveDataSize: {
			bytes: totalSize,
			humanReadable: await humanFileSize(totalSize)
		},
		versionsAvailableInArchive: flogArchives
	});
});

server.addHook("onRequest", (request: FastifyRequest, reply: FastifyReply, done) => {
	if (hostname == "null") {
		hostname = request.hostname;
		configurationJson.hostname = hostname;
		writeFileSync(join(__dirname, "..", "config.json"), JSON.stringify(configurationJson));
	}
	console.log(`${request.method} ${request.url} by ${request.headers["x-forwarded-for"] || request.ip}`);
	done();
});
server.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" }, (err, address) => {
	if (err) throw err;
	console.log(`Server listening on ${address}`);
});

async function checkVersion() {
	console.log("Checking versions...");

	for (const channel of configurationJson.channelsToCheck) {
		const latestVersionOnChannel = await axiosInstance.get(`https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/${channel}`);
		console.log(`Latest version on channel ${channel} is ${latestVersionOnChannel.data.clientVersionUpload}`);

		if (!existsSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`))) {
			const startTimer = Date.now();

			const location = await download(latestVersionOnChannel.data.clientVersionUpload, channel, axiosInstance, deploymentTempDirectory);
			console.log(`Downloaded version ${latestVersionOnChannel.data.clientVersionUpload} to ${location}...`);
			const extractionLocation = await extractArchive(location, deploymentTempDirectory);
			console.log(`Extracted version ${latestVersionOnChannel.data.clientVersionUpload} to ${extractionLocation}...`);
			const flogs = await gatherFLogs(extractionLocation);
			console.log(`Gathered FLogs for version ${latestVersionOnChannel.data.clientVersionUpload} to ${join(__dirname, "..", "data", "flogs", latestVersionOnChannel.data.clientVersionUpload)}...`);
			const flogHash = createHash("md5").update(Buffer.from(flogs)).digest("hex");
			console.log(`FLog hash for version ${latestVersionOnChannel.data.clientVersionUpload} is ${flogHash}!`);

			console.log(`Archiving version ${latestVersionOnChannel.data.clientVersionUpload}...`);
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
				hash: flogHash,
				flogs: flogs
			}));
			console.log(`Archived version ${latestVersionOnChannel.data.clientVersionUpload}!`);
			
			let diff: any
			let diff_file_location: any
			if (existsSync(join(__dirname, "..", "data", channel, `channel_archive_meta.json`))) {
				const previousArchiveMeta = JSON.parse(readFileSync(join(__dirname, "..", "data", channel, `channel_archive_meta.json`), "utf-8"));
				const previousFlogs = JSON.parse(readFileSync(join(__dirname, "..", "data", channel, `${previousArchiveMeta.latestVersion}.json`), "utf-8")).flogs;
				diff = await generateDiff(flogs, previousFlogs);
				console.log(`Generated diff for version ${latestVersionOnChannel.data.clientVersionUpload}!`);
				diff_file_location = join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}-v-${previousArchiveMeta.latestVersion}-diff.txt`);
				writeFileSync(diff_file_location, diff.join("\n"));
			} else {
				console.warn(`channel_archive_meta.json does not exist for channel ${channel} therefore a diff cannot be generated! It will be created after configuration update...`);
			}

			if (webhooksEnabled === true) {
				const statInfo = statSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`));
				const archiveInfo = await getArchiveStats();
				if (!Array.isArray(diff) || diff.length == 0) { diff = "No diff available :(" } else { diff = diff.join("\n") };

				console.log("Sending webhook(s)...");
				let rolesToPing = process.env.ROLE_TO_PING.split(",");
				let webhooks = process.env.DISCORD_WEBHOOK_URL.split(",");
				let webhookIndex = 0;
				if (rolesToPing.length !== webhooks.length) { console.warn("The amount of roles to ping does not match the amount of webhooks! Please check your .env file!"); }
				
				for (const webhook of webhooks) {
					if (diff.length > 4096) {
						diff = "Diff too large to send! A follow-up message will be posted with diff attached as a file... D:";
					}

					await axios.post(webhook, {
						content: rolesToPing[webhookIndex] !== "0" && diff !== "No diff available :(" ? `<@&${rolesToPing[webhookIndex]}>` : null,
						embeds: [
							{
								title: "📥 New FLog archive!",
								description: `Archive has been created for \`${latestVersionOnChannel.data.clientVersionUpload}\` (\`${latestVersionOnChannel.data.version}\`) in channel \`${channel}\` <t:${Math.floor(Date.now() / 1000)}:R>!\nArchive size: \`${await humanFileSize(statInfo.size)}\`\nHash: \`${flogHash}\`\nArchive size: \`${await humanFileSize(archiveInfo.totalSize)}\`\n[View Archive via API](https://${hostname}/api/getarchive/${channel}/${latestVersionOnChannel.data.clientVersionUpload})`,
								footer: {
									text: "Roblox FLog Archival Program - Operation completed in " + (Date.now() - startTimer) + "ms",
									icon_url: null
								}
							},
							{
								description: `\`\`\`diff\n${diff}\n\`\`\``,
							}
						],
					}).catch((err) => {
						console.warn(`Failed to send webhook: ${err}`);
						axios.post(webhook, {
							content: `Failed to send webhook: ${err}! Please check the logs for more information.${rolesToPing[webhookIndex] !== "0" ? ` <@&${rolesToPing[webhookIndex]}>` : null}`,
						})
					});

					if (diff.includes("Diff too large to send!")) {
						console.log("Sending follow-up message with diff file...");
						await axios.post(webhook, {
							content: "Freshly baked diff you ordered! x3",
							file: createReadStream(diff_file_location)
						}, {
							headers: {
								"Content-Type": "multipart/form-data"
							}
						}).catch((err) => {
							console.warn(`Failed to send webhook for DIFF: ${err}`);
							axios.post(webhook, {
								content: `Failed to send webhook for DIFF file follow-up: ${err}! Please check the logs for more information.${rolesToPing[webhookIndex] !== "0" ? ` <@&${rolesToPing[webhookIndex]}>` : null}`,
							})
						});
					}

					webhookIndex++;
				}
			}

			console.log("Updating channel_archive_meta.json...");
			writeFileSync(join(__dirname, "..", "data", channel, "channel_archive_meta.json"), JSON.stringify({
				lastWrite: Date.now(),
				latestVersion: latestVersionOnChannel.data.clientVersionUpload
			}));
			console.log("Updating config.json...");
			configurationJson.latestArchival = `${channel}/${latestVersionOnChannel.data.clientVersionUpload}`;
			writeFileSync(join(__dirname, "..", "config.json"), JSON.stringify(configurationJson));

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
