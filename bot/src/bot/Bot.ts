import Mirai, { MiraiApiHttpConfig, MessageType } from "mirai-ts";
import Fastify from "fastify";
import middie from "middie";
import pointOfView from "point-of-view";
import ejs from "ejs";
import { UI } from "bull-board";
import MiraiBotCommand, { MiraiBotCommandConfig } from "./Command";
import { CmdHook } from "./Command";
import * as utils from "./utils/utils";
import { Target } from "./utils/utils";
import { unserialize } from "./serialization";

export interface MiraiBotConfig {
  account: number;
  commandPrefix: string;
  privilege?: number;
}

export class MiraiBot {
  mirai: Mirai;
  config: MiraiBotConfig;
  cmdHooks: Set<MiraiBotCommand>;
  fastify = Fastify();
  constructor(mirai: Mirai | MiraiApiHttpConfig, config: MiraiBotConfig) {
    this.cmdHooks = new Set();
    if (mirai instanceof Mirai) {
      this.mirai = mirai;
    } else {
      this.mirai = new Mirai(mirai);
    }
    this.config = config;
    MiraiBot.currentBot = this;
  }

  async boot() {
    await this.mirai.login(904814779);
    await this.mirai.axios.post("/config", {
      sessionKey: this.mirai.sessionKey,
      cacheSize: 4096,
      enableWebsocket: true,
    });
    this.mirai.on("message", (msg) => {
      console.log(msg);
      this.messageHook(msg);
    });
    this.fastify.register(pointOfView, {
      engine: {
        ejs: ejs,
      },
    });
    this.fastify.register(middie);
    this.fastify.use("/bull", UI);

    this.mirai.listen();
    this.fastify.listen(8080, "0.0.0.0");
  }

  registerCommand(cmd: string | MiraiBotCommandConfig, hook: CmdHook) {
    this.cmdHooks.add(new MiraiBotCommand(this, cmd, hook));
  }

  registerPlugins(...plugins: ((bot: MiraiBot) => void)[]) {
    plugins.forEach((i) => i(this));
  }

  private messageHook(msg: MessageType.ChatMessage) {
    const plain = msg.plain;
    if (plain && plain.startsWith(this.config.commandPrefix)) {
      console.log("Cmd: " + plain);
      const cmdline = plain
        .slice(this.config.commandPrefix.length)
        .trim()
        .split(" ");
      this.cmdHooks.forEach((v) =>
        v.run(msg, cmdline[0], cmdline.slice(1).join(" "))
      );
    }
  }

  send(target: Target, msg: string, quote?: number) {
    if (target.group) {
      return this.mirai.api.sendGroupMessage(
        unserialize(msg),
        target.group,
        quote
      );
    } else if (target.temp) {
      return this.mirai.api.sendTempMessage(
        unserialize(msg),
        target.id,
        target.temp,
        quote
      );
    } else {
      return this.mirai.api.sendFriendMessage(
        unserialize(msg),
        target.id,
        quote
      );
    }
  }

  static utils = utils;
  private static currentBot?: MiraiBot;
  static getCurrentBot(): MiraiBot {
    if (!MiraiBot.currentBot) {
      throw new Error("No current bot!");
    }
    return MiraiBot.currentBot;
  }
}
