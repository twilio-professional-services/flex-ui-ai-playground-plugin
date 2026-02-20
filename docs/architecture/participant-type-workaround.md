# Participant Type Workaround

## Problem

When conversations are hydrated via `<Transcription>`, both participants default to `CUSTOMER` type. This means the agent participant is not correctly identified as `HUMAN_AGENT`, which can affect downstream features that rely on participant type (e.g., Conversation Intelligence operators, transcript attribution).

## Workaround

The `handleConversationEvents` function listens for `PARTICIPANT_ADDED` webhook events. When a new participant is added, it checks if the participant's name matches one of the Twilio phone numbers on the account. If it does and the participant is not already typed as `HUMAN_AGENT`, it updates the participant type to `HUMAN_AGENT` via the v2 Conversations API.

## When This Is Not Needed

This workaround is **not required** for conversations hydrated via capture rules, which correctly assign participant types automatically.
