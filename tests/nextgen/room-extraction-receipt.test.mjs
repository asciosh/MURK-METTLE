import test from 'node:test';
import assert from 'node:assert/strict';
import { extractionStarted, extractionConfirmed, extractionFailed, extractionMessage } from '../../src/nextgen/core/RoomExtractionReceipt.mjs';

test('cannot show extraction result without a server-issued positive sequence', () => {
  assert.equal(extractionStarted(0), null);
  assert.equal(extractionStarted(NaN), null);
  assert.equal(extractionStarted(2.5), null);
});
test('successful extraction begins pending and confirms only with valid reward packet', () => {
  const before=extractionStarted(1);
  assert.equal(before.status,'pending');
  assert.match(extractionMessage(before),/Waiting for your account reward/);
  const confirmed=extractionConfirmed(before,{xp:150,completed:1,totals:{xp:350}});
  assert.equal(confirmed.status,'confirmed');
  assert.equal(confirmed.totalXp,350);
  assert.match(extractionMessage(confirmed),/ACCOUNT REWARD VERIFIED.*150 XP/);
});
test('never invent a successful reward from incomplete data', () => {
  const before=extractionStarted(2);
  assert.equal(extractionConfirmed(before,{xp:150,completed:2,totals:{}}),before);
  assert.equal(extractionConfirmed(before,{xp:-1,completed:2,totals:{xp:10}}),before);
});
test('dead players see team extraction without invented personal reward', () => {
  const receipt=extractionStarted(3,false);
  assert.equal(receipt.status,'ineligible');
  assert.match(extractionMessage(receipt),/not among the living participants/);
  assert.equal(extractionConfirmed(receipt,{xp:150,completed:3,totals:{xp:150}}).status,'confirmed'); // An authoritative reward overrides stale local eligibility.
});
test('failed account reward is explicit instead of silently appearing successful', () => {
  const failed=extractionFailed(extractionStarted(4));
  assert.equal(failed.status,'failed');
  assert.match(extractionMessage(failed),/REWARD NOT CONFIRMED/);
});
