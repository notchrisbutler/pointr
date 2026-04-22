# Session Simplification Design

## Summary

Strip Pointr back to a single fresh-round planning flow by removing story sequencing, story text/comments, and all player-host concepts. Keep observers, timers, voting, reveal/results, final vote selection, session id sharing, and the player list.

## Context

- `src/pages/session-sections.ts` currently renders three stages: lobby, story setup, and the main session board.
- `src/client.ts` coordinates those stages, manages local story lists/navigation, and hides some controls behind `amHost` logic.
- `src/session.ts` persists story lists, current story position, `sessionReady`, and per-player `isHost` state in the Durable Object.
- The current product direction is simpler: every round should start fresh with no story/comment field, no sequenced ticket flow, and no special player role for controlling the session.

## Goals

- Remove all story-setup and sequenced-round functionality from the session UI, browser client, server state, and tests.
- Remove all host-specific player behavior and permissions while keeping the server as the authority for state changes.
- Preserve observer mode.
- Keep the existing voting/reveal/new-round/results flow, including average, median, vote count, final vote selection, timers, session id copy, and player list.
- Make the session board the only post-join view.

## Non-Goals

- Remove observer mode.
- Redesign the visual language of the existing session board beyond what is needed to delete story and host UI.
- Change the session id format, reconnect behavior, or inactivity timeout behavior.
- Rework the final-vote/results model.

## Chosen Direction

Archetype: Minimal multiplayer planning board.

Differentiator: the session becomes a single shared round surface with no hidden moderator role and no carried-forward story state between rounds.

Delivery choice: simplify the HTML contract, browser client state machine, and Durable Object payload together so the product model and implementation model stay aligned.

## Approaches Considered

### 1. Full model simplification (chosen)

Delete story/setup/navigation state and host concepts across the page templates, client, Durable Object, and tests.

Pros:
- Matches the requested product behavior directly.
- Removes dead branches instead of hiding them.
- Leaves a smaller and easier-to-reason-about session model.

Cons:
- Touches multiple layers at once.

### 2. UI-only cleanup

Hide story and host controls in the interface but keep most of the current payload and server state.

Pros:
- Smaller initial diff.

Cons:
- Leaves obsolete behavior in the codebase.
- Makes future maintenance harder because the code would still describe a product that no longer exists.

### 3. Partial server cleanup

Remove host restrictions but keep the story and setup model internally.

Pros:
- Reduces one source of complexity.

Cons:
- Does not satisfy the request to strip out story/sequenced-round functionality.
- Retains `sessionReady`, `stories`, and story navigation paths that no longer serve the product.

## Design Details

### Session flow

- Keep the lobby as the first screen.
- After a user joins as player or observer, transition directly from `#lobby` to `#session`.
- Remove the `#story-setup` stage entirely.
- Remove the concept of a session waiting to become "ready" after setup. Joining a session is sufficient to enter the board.

### Session board UI

- Keep these elements on the board:
  - brand/header
  - session id copy affordance
  - voting timer
  - discussion timer
  - vote card row for players
  - primary action button that switches between `Start Round`, `Show Votes`, and disabled `Votes Shown`
  - `New Round` button
  - results area with average, median, vote count, and final vote cards
  - players list
- Remove these elements from the board:
  - story label and textarea
  - story setup card and its add/list/start controls
  - story previous/next/progress navigation
  - any host-only visibility behavior

### Browser client behavior

- Remove local story-setup state such as `localStories`, story setup DOM references, and story navigation DOM references.
- Remove `amHost` from client state.
- Remove client behavior for:
  - `set-stories`
  - `skip-setup`
  - `story-next`
  - `story-prev`
  - any host-specific control hiding
- Keep player behavior:
  - players can vote when a round is active and not revealed
  - any player can start a round
  - any player can reveal votes
  - any player can start a new round
  - any player can set or clear the final vote during discussion
- Keep observer behavior:
  - observers can join and watch state changes
  - observers still cannot cast votes
- Fresh round semantics after `clear`:
  - reset all votes
  - reset reveal/final/timer state
  - do not carry forward any story/comment text because that state no longer exists

### Durable Object state

- Remove persisted round/session fields for:
  - `storyDescription`
  - `stories`
  - `currentStoryIndex`
  - `sessionReady`
- Remove per-player host state from attachments and in-memory player state.
- Remove host-only action enforcement and host transfer/reassignment helpers.
- Keep persisted round/session fields for:
  - `revealed`
  - `roundStartTime`
  - `revealTime`
  - `finalVote`
  - `pointValues`
  - `discussionPausedAt`
  - `discussionPausedTotal`
- Keep player state for:
  - `clientId`
  - `name`
  - `vote`
  - `isObserver`

### WebSocket contract

- Keep incoming message types:
  - `join`
  - `vote`
  - `start`
  - `reveal`
  - `final`
  - `clear`
- Remove incoming message types:
  - `story`
  - `set-stories`
  - `skip-setup`
  - `story-next`
  - `story-prev`
  - `story-goto`
  - `transfer-host`
- Keep `joined`, `state`, `timeout`, and `error` responses, but remove host/story/setup fields from payloads.

### Test impact

- Update DOM-contract tests in `test/routes.spec.ts` and `test/page-rendering.spec.ts` to assert the simplified session page anchors and to stop expecting story/setup markup.
- Update browser-client tests in `test/client.spec.ts` to remove story-setup transitions and host-specific behavior, and to assert direct lobby-to-session flow.
- Update session and identity tests to remove host fields from fixtures and remove any assumptions about host assignment or transfer.
- Add or adjust Durable Object behavior tests so shared player permissions are explicit: a normal player can trigger start, reveal, clear, and final-vote actions; observers still cannot vote.

## Implementation Notes

- Prefer deleting branches and state fields rather than leaving compatibility shims.
- Keep the change small by preserving existing naming where behavior still exists, such as `show-votes-btn`, `new-round-btn`, and result-stat ids.
- Update the README feature list and product description to match the simplified session model after the code changes land.

## Verification

- Run the session/page/unit test suite and update expectations to the new DOM and payload contract.
- Verify that joining as a player goes directly from lobby to session board.
- Verify that joining as an observer goes directly from lobby to session board and that the observer still cannot vote.
- Verify that any player can start, reveal, clear, and set the final vote.
- Verify that a new round always starts fresh with cleared votes and no story/comment content.

## Risks

- Story/setup state is woven through the client and Durable Object, so partial deletion could leave stale references or payload mismatches.
- Some tests currently encode the old DOM shape very directly, so they will fail noisily until updated together.
- The current reconnect and identity helpers carry host-related fixture shape in tests; those fixtures need to be simplified carefully to avoid false failures.
