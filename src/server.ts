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
		"User-Agent": "Roblox FLog Archive Program - https://github.com/WaviestBalloon/RobloxFLogArchive", // Let's be nice and tell Roblox who we are :3
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
	if (!existsSync(join(__dirname, "..", "data", request.params?.channel))) {
		reply.code(404).send("Unable to find Channel in archive.");
	} else {
		//@ts-ignore
		if (!existsSync(join(__dirname, "..", "data", request.params?.channel, `${request.params?.version}.json`))) {
			reply.code(404).send("Version not found.");
		} else {
			//@ts-ignore
			let json = JSON.parse(readFileSync(join(__dirname, "..", "data", request.params?.channel, `${request.params?.version}.json`), "utf-8"));
			//@ts-ignore
			if (!configurationJson.channelsToCheck.includes(request.params?.channel)) {
				json["notice"] = "This channel is no longer being tracked, this archive is here for historical purposes only."
			}

			//@ts-ignore
			reply.send(json, "utf-8");
		}
	}
});
async function getArchiveStats() {
	let totalSize = 0;
	let versionFiles = 0;
	let stubbedFiles = 0;
	let flogArchives: any = {};
	readdirSync(join(__dirname, "..", "data")).forEach(async (channel) => {
		readdirSync(join(__dirname, "..", "data", channel)).forEach(async (version) => {
			version = join(__dirname, "..", "data", channel, version);
			if (version.endsWith(".json") && !version.includes("channel_archive_meta")) {
				const archiveFile = readFileSync(version, "utf-8");

				if (archiveFile == "SKIPPED") {
					//console.log(`Found STUB archived FLogs for ${version.split("/")[version.split("/").length - 1].split(".")[0]} in channel ${channel}...`);
					stubbedFiles += 1;
				} else {
					//console.log(`Found archived FLogs for ${version.split("/")[version.split("/").length - 1].split(".")[0]} in channel ${channel}...`);
					const jsonParsed = JSON.parse(archiveFile);
					totalSize += statSync(version).size;
					versionFiles += 1;
					flogArchives[channel] = {
						...flogArchives[channel],
						[version.split("/")[version.split("/").length - 1].split(".")[0]]: {
							timestamp: jsonParsed.timestamp,
							size: statSync(version).size,
							hash: jsonParsed.hash,
							viewUrl: `https://${hostname}/api/getarchive/${channel}/${version.split("/")[version.split("/").length - 1].split(".")[0]}`
						}
					};
				}
			}
		});
	});

	return { totalSize, versionFiles, flogArchives, stubbedFiles };
}
server.get("/api/info", async (request: FastifyRequest, reply: FastifyReply) => {
	const { totalSize, versionFiles, flogArchives, stubbedFiles } = await getArchiveStats();

	reply.send({
		uptime: process.uptime(),
		channelsTracked: configurationJson.channelsToCheck,
		versionsCurrentlyArchived: versionFiles,
		latestArchival: `https://${hostname}/api/getarchive/${configurationJson.latestArchival}`,
		archiveInfo: {
			storage: {
				bytes: totalSize,
				humanReadable: await humanFileSize(totalSize)
			},
			stubbedFiles: stubbedFiles,
			archiveFiles: versionFiles,
			totalFiles: stubbedFiles + versionFiles
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

async function archiveRoutine(channel: string) {
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
			//@ts-ignore
			const flogHash = createHash("md5").update(Buffer.from(flogs)).digest("hex");
			console.log(`FLog hash for version ${latestVersionOnChannel.data.clientVersionUpload} is ${flogHash}!`);

			console.log(`Creating archive data for version ${latestVersionOnChannel.data.clientVersionUpload}...`);
			if (!existsSync(join(__dirname, "..", "data", channel))) {
				mkdirSync(join(__dirname, "..", "data", channel));
			}
			const archiveDataJson = JSON.stringify({
				rbxResponse: {
					version: latestVersionOnChannel.data.version,
					clientVersionUpload: latestVersionOnChannel.data.clientVersionUpload,
					bootstrapperVersion: latestVersionOnChannel.data.bootstrapperVersion,
				},
				timestamp: Date.now(),
				hash: flogHash,
				flogs: flogs
			});
			
			let diffInfo: { diffResult: Array<string>, additions: number, removals: number } = { diffResult: [], additions: 0, removals: 0 };
			let diff_file_location: any
			if (existsSync(join(__dirname, "..", "data", channel, `channel_archive_meta.json`))) {
				const previousArchiveMeta = JSON.parse(readFileSync(join(__dirname, "..", "data", channel, `channel_archive_meta.json`), "utf-8"));
				const previousFlogs = JSON.parse(readFileSync(join(__dirname, "..", "data", channel, `${previousArchiveMeta.latestVersion}.json`), "utf-8")).flogs;
				diffInfo = await generateDiff(flogs, previousFlogs);
				console.log(`Generated diff for version ${latestVersionOnChannel.data.clientVersionUpload}!`);

				if (configurationJson.doNotArchiveIfPreviousArchiveFLogsMatchDiff) {
					if (diffInfo.diffResult.length == 0) {
						console.log("Diff is empty, skipping archival...");
						writeFileSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`), "SKIPPED");
						console.log("Cleaning up temporary file...");
						rmSync(extractionLocation, { recursive: true });
						return;
					}
				}

				diff_file_location = join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}-v-${previousArchiveMeta.latestVersion}-diff.txt`);
				writeFileSync(diff_file_location, diffInfo.diffResult.join("\n"));
			} else {
				console.warn(`channel_archive_meta.json does not exist for channel ${channel} therefore a diff cannot be generated! It will be created after configuration update...`);
			}

			console.log("Writing archive data to disk...");
			writeFileSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`), archiveDataJson);
			console.log("Updating channel_archive_meta.json...");
			writeFileSync(join(__dirname, "..", "data", channel, "channel_archive_meta.json"), JSON.stringify({
				lastWrite: Date.now(),
				latestVersion: latestVersionOnChannel.data.clientVersionUpload
			}));
			console.log("Updating config.json...");
			configurationJson.latestArchival = `${channel}/${latestVersionOnChannel.data.clientVersionUpload}`;
			writeFileSync(join(__dirname, "..", "config.json"), JSON.stringify(configurationJson));
			
			if (webhooksEnabled === true) {
				const statInfo = statSync(join(__dirname, "..", "data", channel, `${latestVersionOnChannel.data.clientVersionUpload}.json`));
				const archiveInfo = await getArchiveStats();
				let diff: string | Array<string> = diffInfo.diffResult;
				if (!Array.isArray(diff) || diff.length == 0) { diff = "No diff available :(" } else { diff = diff.join("\n") };

				console.log("Sending webhook(s)...");
				let rolesToPing = process.env.ROLE_TO_PING.split(",");
				let webhooks = process.env.DISCORD_WEBHOOK_URL.split(",");
				let webhookIndex = 0;
				if (rolesToPing.length !== webhooks.length) { console.warn("The amount of roles to ping does not match the amount of webhooks! Please check your .env file!"); }
				
				for (const webhook of webhooks) {
					if (diff.length > 4000) {
						diff = "Diff too large to send! A follow-up message will be posted with diff attached as a file...";
					}

					await axios.post(webhook, {
						content: rolesToPing[webhookIndex] !== "0" && diff !== "No diff available :(" ? `<@&${rolesToPing[webhookIndex]}>` : null,
						embeds: [
							{
								title: "📥 New FLog archive!",
								description: `Archive has been created for \`${latestVersionOnChannel.data.clientVersionUpload}\` (\`${latestVersionOnChannel.data.version}\`) in channel \`${channel}\` <t:${Math.floor(Date.now() / 1000)}:R>!\nArchive size: \`${await humanFileSize(statInfo.size)}\`\nHash: \`${flogHash}\`\nTotal archive storage size: \`${await humanFileSize(archiveInfo.totalSize)}\`\n[View Archive via API](https://${hostname}/api/getarchive/${channel}/${latestVersionOnChannel.data.clientVersionUpload})`,
								footer: {
									text: "Operation completed in " + (Date.now() - startTimer) + "ms",
									icon_url: null
								}
							},
							{
								description: `***+ ${diffInfo.additions}*** ***- ${diffInfo.removals}***\`\`\`diff\n${diff}\n\`\`\``,
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

			console.log("Cleaning up temporary file...");
			rmSync(extractionLocation, { recursive: true });
		} else {
			console.log(`Version ${latestVersionOnChannel.data.clientVersionUpload} has already been archived, no changes...`);
		}
}

async function checkVersion() {
	console.log("Checking versions...");

	for (const channel of configurationJson.channelsToCheck) {
		try {
			await archiveRoutine(channel);
		} catch (err) {
			if (err.toString().includes("401")) {
				console.error(`Failed to archive channel ${channel}! Skipping...\nError: ${err}\nThis is probably because you're trying to fetch from a restricted deployment channel, best to remove it from your config.json file!`);
			} else {
				console.error(`Failed to archive channel ${channel}! Skipping...\nError: ${err}`);
			}
		}
	}
}

checkVersion();
console.log("Starting version check interval...");
setInterval(checkVersion, 150000); // Every 2.5 minutes
