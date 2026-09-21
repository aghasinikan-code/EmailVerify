const test = require('node:test')
const assert = require('node:assert/strict')
const { FORM_SPECS, desiredFormRoleNames } = require('../src/utils/reconcileFormRoles')

test('defines exactly one form connection for every form', () => {
    assert.equal(FORM_SPECS.length, 60)
    assert.equal(new Set(FORM_SPECS.map(spec => spec.formRole)).size, 60)
})

test('assigns only the matching form role when every source role is present', () => {
    const roles = new Set(['Year 10', 'X-Side temp', 'Verified Student', 'House of Imperial'])
    assert.deepEqual(desiredFormRoleNames(roles), new Set(['10xIM']))
})

test('does not assign any form role if a required source role is absent', () => {
    const roles = new Set(['Year 10', 'X-Side temp', 'House of Imperial'])
    assert.deepEqual(desiredFormRoleNames(roles), new Set())
})

test('does not leak access between form, year, side, or house combinations', () => {
    const roles = new Set(['Year 13', 'Y-Side temp', 'Verified Student', 'House of Warwick'])
    assert.deepEqual(desiredFormRoleNames(roles), new Set(['13yWA']))
})
