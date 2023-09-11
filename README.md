# Roblox FLog Archive
Roblox FLog Archive is a small service to archive plaintext FLogs in the Roblox Player binary.

You can view the archive overview at https://roblox-flog-archive.wav.blue/api/info

A proper frontend will be created at a later date!

## Why though??

Roblox engineers sometimes add little easter eggs that get appended to your Roblox log files during client initialisation, I always enjoyed seeing them whilst inspecting my log files and have decided to start a archival program to keep a history of all FLogs found in the Player binary.
As a bonus, normal FLogs will not be excluded from being archived. (Because that would be too much work for my poor brain x3)

Additionally, I may also expand FLog archives to not just the Player binary but also the Studio binary.

## Starting your own instance

Although I don't see why you would want to, but if you insist, see below!

> [!IMPORTANT]
> You need to deploy this onto a Linux-based server, as the command used for extracting the FLogs from the binary is a Linux command.

### Requirements

- Node.js ([NVM is recommended](https://github.com/nvm-sh/nvm#installing-and-updating))
- NPM ([PnpM is recommended](https://pnpm.io/))
- A Linux-based server (I recommend any Debian-based distribution, such as [Ubuntu Server](https://ubuntu.com/download/server))

1. Install project packages using your Node.js package manager of choice
2. Make a copy of `.env.example` and name it `.env`, modify it to your liking
3. Run `startserver.sh` script
4. (Optional) Run the script in a daemon like [pm2](https://pm2.io/) to constantly run the server in the background

Optionally, you can set up Discord webhook notifications for when new FLogs are archived!
- `WEBHOOKS_ENABLED` - Controls whether notifications should be active
- `DISCORD_WEBHOOK_URL` - The URL of the Discord webhook
- `ROLE_TO_PING` - Set to `0` if you do not want to ping any role, if you do want to ping a role change it to the Role ID and make sure the role is pingable

> [!WARNING]
> **Do not modify `config.json` during the server runtime!** It may lead to any changes made being discarded/overwritten! Make sure you stop the server process, make changes to the file and then restart the process again.
>
> **Do not modify the `latestArchival` and `hostname` values in the configuration file** with one exception, if you have changed the (sub)domain that points to the server, change `hostname` value to be "null", start the server and make a request to the new (sub)domain, the `hostname` value should be updated to the new (sub)domain that you used to sent the request.

## Honorable mentions

- `Hello from your car's extended warranty!`
- `Hi rawr to author of CLI 72542`
- `Hello, it's builderman. I lost my wallet and need you to wire me a few hundred dollars.`
- `Hi! Ok, does venmo work?` (Probably a reply to the FLog above)
- `Did you ever hear the tragedy of Darth Plagueis The Wise? I thought not.`
- `Hello everyone! Hope I'm doing this right`
- `WAZZZZUP`
- `Hello from your car's extended warranty!`
- `You are the next heir to the deceased king of Congo. Claim your prize today!`
- `When I get sad, I just stop being sad and be awesome instead!`
- `Hi, this is Alex! I am surprised if you are reading this, have a good day.`
