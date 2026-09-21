// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nikan Aghasi
//
// Keep UHS form roles in sync with the four source roles that Sapphire role
// connections used: year, X/Y side, Verified Student, and house.

const HOUSE_NAMES = {
    IM: 'Imperial',
    OX: 'Oxford',
    CA: 'Cambridge',
    WA: 'Warwick',
    BR: 'Brunel'
}

const UHS_GUILD_ID = '1550173395201691769'

const FORM_SPECS = Object.freeze(
    [8, 9, 10, 11, 12, 13].flatMap(year =>
        ['x', 'y'].flatMap(side =>
            Object.entries(HOUSE_NAMES).map(([houseCode, houseName]) => ({
                formRole: `${year}${side}${houseCode}`,
                requiredRoles: [
                    `Year ${year}`,
                    `${side.toUpperCase()}-Side temp`,
                    'Verified Student',
                    `House of ${houseName}`
                ]
            }))
        )
    )
)

const memberQueues = new Map()

function desiredFormRoleNames(roleNames) {
    const names = roleNames instanceof Set ? roleNames : new Set(roleNames)
    return new Set(
        FORM_SPECS
            .filter(spec => spec.requiredRoles.every(role => names.has(role)))
            .map(spec => spec.formRole)
    )
}

async function reconcileFormRolesNow(member) {
    if (member.guild.id !== UHS_GUILD_ID) return
    // Fetch a current member snapshot because Discord can emit a separate update for
    // each source-role change. This makes the final role set independent of event order.
    const currentMember = await member.guild.members.fetch(member.id)
    const guild = currentMember.guild
    const rolesByName = new Map(guild.roles.cache.map(role => [role.name, role]))
    const sourceRoleNames = new Set(currentMember.roles.cache.map(role => role.name))
    const wanted = desiredFormRoleNames(sourceRoleNames)

    for (const spec of FORM_SPECS) {
        const target = rolesByName.get(spec.formRole)
        const sourcesExist = spec.requiredRoles.every(name => rolesByName.has(name))
        if (!target || !sourcesExist || target.managed) continue

        const hasTarget = currentMember.roles.cache.has(target.id)
        const shouldHaveTarget = wanted.has(spec.formRole)
        if (hasTarget === shouldHaveTarget) continue

        if (!target.editable) {
            console.warn(`[UHS forms] Cannot ${shouldHaveTarget ? 'assign' : 'remove'} ${target.name}: move the bot role above it.`)
            continue
        }

        if (shouldHaveTarget) {
            await currentMember.roles.add(target, 'UHS form role connection')
        } else {
            await currentMember.roles.remove(target, 'UHS form role connection')
        }
    }
}

/**
 * Queue one reconciliation per member so bursts of role updates cannot race.
 * @param {import('discord.js').GuildMember} member
 */
function reconcileFormRoles(member) {
    if (member.user.bot) return Promise.resolve()
    const prior = memberQueues.get(member.id) || Promise.resolve()
    const next = prior
        .catch(() => {})
        .then(() => reconcileFormRolesNow(member))
        .catch(error => console.warn(`[UHS forms] Could not reconcile ${member.id}:`, error?.message || error))
        .finally(() => {
            if (memberQueues.get(member.id) === next) memberQueues.delete(member.id)
        })
    memberQueues.set(member.id, next)
    return next
}

/** @param {import('discord.js').Guild} guild */
async function reconcileGuildFormRoles(guild) {
    if (guild.id !== UHS_GUILD_ID) return
    const members = await guild.members.fetch()
    for (const member of members.values()) await reconcileFormRoles(member)
}

module.exports = { FORM_SPECS, desiredFormRoleNames, reconcileFormRoles, reconcileGuildFormRoles }
