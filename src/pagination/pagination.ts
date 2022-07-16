import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
    MessageButtonStyleResolvable,
    MessageComponentType,
    MessageEmbed,
    TextChannel
} from "discord.js"
import { ButtonsDefault, ButtonsValues, PaginationOptions } from "./pagination.i";

const defaultEmojis = {
    first: "⬅️",
    previous: "◀️",
    next: "▶️",
    last: "➡️",
    number: "#️⃣"
}

const defaultStyles = {
    first: "PRIMARY",
    previous: "PRIMARY",
    next: "PRIMARY",
    last: "PRIMARY",
    number: "SUCCESS"
}

export const pagination = async (options: PaginationOptions) => {
    const { interaction, message, author, embeds, buttons, time, max, customFilter, fastSkip, pageTravel } = options
    let currentPage = 1;

    if (!interaction && !message) throw new Error("Pagination requires either an interaction or a message object");
    const type = interaction ? 'interaction' : 'message';

    const getButtonData = (value: ButtonsValues) => {
        return buttons?.find((btn) => btn.value === value);
    }

    const resolveButtonName = (value: ButtonsValues) => {
        return (Object.keys(ButtonsDefault) as (keyof typeof ButtonsDefault)[]).find((key) => {
            return ButtonsDefault[key] === value;
        });
    }

    const generateButtons = (state?: boolean) => {
        const checkState = (value: ButtonsValues) => {
            if (([1, 2]).includes(value) && currentPage === 1) return true;
            return ([3, 4]).includes(value) && currentPage === embeds.length;
        }

        let names: ButtonsValues[] = [2, 3];
        if (fastSkip) names = [1, ...names, 4];
        if (pageTravel) names.push(5);

        return names.reduce(
            (accumulator: MessageButton[], value: ButtonsValues) => {
                let embed = new MessageButton()
                    .setEmoji(getButtonData(value)?.emoji || defaultEmojis[resolveButtonName(value)])
                    .setCustomId(value.toString())
                    .setDisabled(state || checkState(value))
                    .setStyle(getButtonData(value)?.style || (defaultStyles[resolveButtonName(value)] as MessageButtonStyleResolvable));
                if (getButtonData(value)?.label) embed.setLabel(getButtonData(value).label);
                accumulator.push(embed);
                return accumulator;
            },
            []
        )
    }


    const components = (state?: boolean) => [
        new MessageActionRow().addComponents(generateButtons(state))
    ]

    const changeFooter = () => {
        const embed = embeds[currentPage - 1];
        const newEmbed = new MessageEmbed(embed);
        if (embed?.footer?.text) {
            return newEmbed.setFooter({
                text: `${embed.footer.text} - Page ${currentPage} of ${embeds.length}`,
                iconURL: embed.footer.iconURL
            });
        }
        return newEmbed.setFooter({
            text: `Page ${currentPage} of ${embeds.length}`
        });
    }

    let initialMessage;
    let channel: TextChannel = message?.channel as TextChannel || interaction?.channel as TextChannel;

    if (type === 'interaction' && channel) {
        if (interaction.isCommand() || interaction.isApplicationCommand()) {
            if (!interaction.replied) {
                initialMessage = await interaction.reply({
                    embeds: [changeFooter()],
                    components: components(),
                    fetchReply: true
                });
            } else {
                initialMessage = await interaction.editReply({
                    embeds: [changeFooter()],
                    components: components()
                });
            }
        }
    } else if (type === 'message' && channel) {
        initialMessage = await channel.send({
            embeds: [changeFooter()],
            components: components()
        });
    }

    const defaultFilter = (interaction: ButtonInteraction) => {
        return interaction.user.id === author.id;
    }

    const collectorOptions = (): any => {
        const opt = {
            filter: customFilter || defaultFilter,
            componentType: "BUTTON" as MessageComponentType
        }

        if (max) opt["max"] = max;
        if (time) opt["time"] = time;

        return opt;
    }

    const collector = channel.createMessageComponentCollector(collectorOptions());
    const pageTravelling = new Set();

    const numberTravel = async () => {
        if (pageTravelling.has(author.id)) return channel.send("Type `end` to stop page travelling!");

        const collectorMessage = channel.createMessageCollector({
            filter: (msg) => msg.author.id === author.id,
            time: 30000
        });
        const numberTravelMessage = await channel.send(`${author.tag}, you have 30 seconds, send numbers in chat to change pages! Simply type \`end\` to exit from page travelling.`);
        pageTravelling.add(author.id);

        collectorMessage.on("collect", (message) => {
            if (message.content.toLowerCase() === "end") {
                message.delete().catch(() => {});
                return collectorMessage.stop();
            }
            const int = parseInt(message.content);
            if (isNaN(int) || !(int <= embeds.length) || !(int >= 1)) return;
            currentPage = int;
            if (type === 'interaction') {
                initialMessage.editReply({
                    embeds: [changeFooter()],
                    components: components()
                });
            } else {
                initialMessage.edit({
                    embeds: [changeFooter()],
                    components: components()
                });
            }

            if (message.guild.me.permissions.has("MANAGE_MESSAGES")) message.delete();
        });

        collectorMessage.on("end", () => {
            if (numberTravelMessage.deletable) numberTravelMessage.delete();
            pageTravelling.delete(author.id);
        });
    }

    collector.on("collect", async (interaction) => {
        const value = parseInt(interaction.customId) as ButtonsValues;

        if (value === 1) currentPage = 1;
        if (value === 2) currentPage--;
        if (value === 3) currentPage++;
        if (value === 4) currentPage = embeds.length;
        if (value === 5) await numberTravel();

        if (type === 'interaction') {
            await interaction.update({
                embeds: [changeFooter()],
                components: components()
            });
        } else {
            await initialMessage.edit({
                embeds: [changeFooter()],
                components: components()
            });
        }

    });

    collector.on("end", () => {
        if (type === 'interaction') {
            initialMessage.editReply({
                components: []
            });
        } else {
            initialMessage.edit({
                components: []
            });
        }
    });
}