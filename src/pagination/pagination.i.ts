import {
    ButtonInteraction,
    MessageEmbed,
    Message,
    User,
    CommandInteraction
} from "discord.js"

export interface PaginationOptions {
    /**
     * Interaction to reply with the pagination system
     */
    interaction?: CommandInteraction

    /**
     * Message to send the pagination system
     */
    message?: Message

    /**
     * Whether the pagination system should be ephemeral
     */
    ephemeral?: boolean

    /**
     * Author's user class
     */
    author: User

    /**
     * array of embed messages to paginate
     */
    embeds: MessageEmbed[]

    /**
     * customize your buttons!
     */
    buttons?: Buttons[]

    /**
     * Disable button or delete button after time
     */
    disableButtons?: boolean

    /**
     * travel pages by sending page numbers?
     */
    pageTravel?: boolean

    /**
     * two additional buttons, a button to skip to the end and a button to skip to the first page
     */
    fastSkip?: boolean

    /**
     * how long before pagination get disabled
     */
    time?: number

    /**
     * maximum interactions before disabling the pagination
     */
    max?: number
    /**
     * custom filter for message component collector
     */
    customFilter?(interaction: ButtonInteraction): boolean
}

export const TypesButtons = {
    first: 1,
    previous: 2,
    next: 3,
    last: 4,
    number: 5
} as const;

type Keys = keyof typeof TypesButtons;
export type ButtonsValues = typeof TypesButtons[Keys];

export interface Buttons {
    value: ButtonsValues
    label?: string|null
    emoji?: string|null
    style: "PRIMARY" | "SECONDARY" | "SUCCESS" | "DANGER"
}