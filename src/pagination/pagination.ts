import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
    MessageButtonStyleResolvable,
    MessageComponentType,
    MessageEmbed,
    TextChannel,
    Modal,
    TextInputComponent,
    ModalActionRowComponent
} from "discord.js"
import { TypesButtons, ButtonsValues, PaginationOptions } from "./pagination.i";

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
        return (Object.keys(TypesButtons) as (keyof typeof TypesButtons)[]).find((key) => {
            return TypesButtons[key] === value;
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
                if (getButtonData(value)?.label) embed.setLabel(getButtonData(value)?.label);
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
        return interaction.user.id === author.id && parseInt(interaction.customId) <= 4;
    }

    const collectorOptions = (filter?): any => {
        const opt = {
            filter: filter || customFilter || defaultFilter,
            componentType: "BUTTON" as MessageComponentType
        }
        if (max) opt["max"] = max;
        if (time) opt["time"] = time;
        return opt;
    }

    const collector = channel.createMessageComponentCollector(collectorOptions());
    let collectorModal;

    if (pageTravel) {
        collectorModal = channel.createMessageComponentCollector(collectorOptions((_i) => _i.user.id === author.id && parseInt(_i.customId) === 5));
        collectorModal.on("collect", async (ButtonInteraction) => {
            // Show modal
            const modal = new Modal()
                .setCustomId('choose_page_modal')
                .setTitle('Choose Page');

            const inputPageNumber = new TextInputComponent()
                .setCustomId('page_number')
                .setLabel('Enter Page Number')
                .setStyle('SHORT')

            const buildModal = new MessageActionRow<ModalActionRowComponent>().addComponents(inputPageNumber);
            modal.addComponents(buildModal);
            await ButtonInteraction.showModal(modal);

            await ButtonInteraction.awaitModalSubmit({
                filter: (_i) => _i.user.id === author.id && _i.customId === 'choose_page_modal',
                time: 30000,
            }).then(async (i) => {
                await i.deferUpdate();
                const int = parseInt(i.fields.getTextInputValue('page_number'));
                if (isNaN(int) || !(int <= embeds.length) || !(int >= 1)) return;
                currentPage = int;
                initialMessage.edit({
                    embeds: [changeFooter()],
                    components: components()
                });
            });
        });
    }

    collector.on("collect", async (interaction) => {
        const value = parseInt(interaction.customId) as ButtonsValues;

        switch (value) {
            case 1: currentPage = 1; break;
            case 2: currentPage--; break;
            case 3: currentPage++; break;
            case 4: currentPage = embeds.length; break;
        }

        await interaction.update({
            embeds: [changeFooter()],
            components: components()
        });
    });

    collector.on("end", () => {
        initialMessage.edit({
            components: []
        });
    });
}