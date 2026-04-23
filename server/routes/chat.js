import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';
import { chat } from '../services/llmRouter.js';
import { LAYOUT_FUNCTIONS, executeFunction } from '../services/chatFunctions.js';

const router = express.Router();

// POST /api/chat/message
router.post('/message', optionalAuth, async (req, res) => {
  const { room_id, message, room_context } = req.body;
  const db = await useDb();
  const isDraft = typeof room_id === 'string' && room_id.startsWith('draft-');

  try {
    let room, placements, history;

    if (isDraft && room_context) {
      // Draft rooms live client-side only — accept context from the request
      room = room_context;
      placements = room_context.placements || [];
      history = [];
    } else if (db) {
      const [roomRes, placementsRes, historyRes] = await Promise.all([
        supabaseAdmin.from('rooms').select('*').eq('id', room_id).eq('user_id', req.user.id).single(),
        supabaseAdmin.from('placements').select('*').eq('room_id', room_id),
        supabaseAdmin
          .from('chat_messages')
          .select('*')
          .eq('room_id', room_id)
          .order('created_at')
          .limit(20),
      ]);
      room = roomRes.data;
      placements = placementsRes.data || [];
      history = historyRes.data || [];
    } else {
      room = fallback.getRoom(room_id, req.user.id);
      placements = room?.placements || [];
      history = fallback.getChatHistory(room_id);
    }

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const stylePrefs = room?.style_preferences;
    const styleContext = stylePrefs
      ? `\nSTYLE PREFERENCES (user-set):\n- Design style: ${stylePrefs.style || 'not set'}\n- Mood: ${stylePrefs.mood || 'not set'}\n- Color palette: ${stylePrefs.color_palette || 'not set'}\n- Budget: ${stylePrefs.budget_preference || 'not set'}\n- Notes: ${stylePrefs.notes || 'none'}\nAlways respect these preferences when suggesting or arranging furniture.\n`
      : '';

    const systemPrompt = `You are an expert AI interior design agent for Vision Studio. You don't just answer questions — you take action by calling tools. You can chain multiple actions autonomously to fulfill complex requests.

CAPABILITIES:
- Move, rotate, add, remove, and swap furniture in the room
- Arrange the entire room layout automatically (arrange_room)
- Search the IKEA and Ashley Furniture catalogs (suggest_furniture)
- Validate layouts for overlaps and clearance issues (validate_layout)
- Furnish an entire room end-to-end: select + place + arrange (furnish_room)
- Record user style/aesthetic preferences (set_style_preference)
- Clear all furniture from the room (clear_room)
- Estimate total budget for current furniture (estimate_budget)
- Get a detailed room summary with coverage and validation (get_room_summary)
- Provide professional design advice for the current layout (design_advice)
- Compare two catalog items side by side (compare_items)

ROOM CONTEXT:
- Room: ${room?.name || 'Unnamed'} — ${room?.width || '?'}" wide × ${room?.depth || '?'}" deep × ${room?.height || 96}" tall
- Unit system: ${room?.unit || 'inches'}
- Current furniture (${placements.length} items):
${placements.length > 0 ? placements.map((p) => `  • ${p.name} (${p.category}) — ${p.width}"W × ${p.depth}"D at (${p.x_inches}", ${p.y_inches}"), rotation ${p.rotation}°`).join('\n') : '  (empty room)'}
${styleContext}
AUTONOMOUS MULTI-STEP BEHAVIOR:
You can call tools in MULTIPLE ROUNDS. After each round of tool calls, you will see the results and can decide to call MORE tools.
This lets you handle complex requests like:
- "Recommend furniture for a living room and arrange it comfortably" → call furnish_room with room_type=living_room
- "Add a sofa, coffee table, and TV stand, then arrange everything" → call add_furniture three times, then call arrange_room
- "What sofas do you have? Add the cheapest one and put it against the wall" → call suggest_furniture, then in the next round call add_furniture + move_furniture
- "Replace the desk with something smaller and rearrange" → call swap_furniture, then call arrange_room
- "I want a Scandinavian feel" → call set_style_preference, then respond acknowledging the preference

CRITICAL TOOL-CALLING RULES:
1. For compound requests ("recommend AND arrange", "furnish the room", "set up a living room"), prefer calling furnish_room — it handles selection, placement, and arrangement in one step.
2. STYLE PREFERENCES → When a user mentions their style, mood, or aesthetic preferences, call set_style_preference FIRST, then incorporate that style into any follow-up actions.
3. RECOMMENDATIONS → ALWAYS call suggest_furniture, never just describe items in text.
4. PLACE / ADD → ALWAYS call add_furniture with computed non-overlapping (x, y) coordinates.
5. ARRANGE → call arrange_room. When asked to organize, arrange, redesign, optimize, or "make it look nice".
6. You can call MULTIPLE tools in a single response (parallel calls). You can also make SEQUENTIAL rounds — after seeing results from round 1, you can call more tools in round 2.
7. Always compute valid (x, y) that respects room bounds and avoids overlap with existing furniture.
8. After ALL tool rounds are done, write a concise summary (1-3 sentences) of everything you did.

COORDINATE SYSTEM:
- x=0 is the left wall, x=room width is the right wall
- y=0 is the top wall, y=room depth is the bottom wall
- rotation 0 = furniture faces +y (downward on plan). For a sofa, the back is at low y and the seat opens toward high y.
- rotation 90 = faces +x (right).  rotation 180 = faces -y (up).  rotation 270 = faces -x (left).

RESPONSE STYLE:
- Be concise and action-oriented. No lengthy preambles.
- Use **bold** for key information like furniture names, prices, and dimensions.
- Use bullet points for lists of suggestions or actions taken.
- Keep summaries to 1-3 sentences after tool actions.`;

    const llmMessages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    // Save user message (skip for draft rooms — they're client-side only)
    if (!isDraft) {
      if (db) {
        await supabaseAdmin.from('chat_messages').insert({ room_id, role: 'user', content: message });
      } else {
        fallback.addChatMessage(room_id, { role: 'user', content: message });
      }
    }

    // --- Multi-turn tool execution loop ---
    const MAX_TOOL_ROUNDS = 5;
    const allActions = [];
    let finalText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await chat({ messages: llmMessages, systemPrompt, tools: LAYOUT_FUNCTIONS });

      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalText = response.text;
        break;
      }

      llmMessages.push(response.raw_message);

      for (const toolCall of response.tool_calls) {
        let fnName, args, result;
        try {
          fnName = toolCall.function?.name;
          args = JSON.parse(toolCall.function?.arguments || '{}');

          // Re-fetch placements before each tool execution (skip for draft rooms)
          if (!isDraft) {
            if (db) {
              const { data } = await supabaseAdmin.from('placements').select('*').eq('room_id', room_id);
              placements = data || [];
            } else {
              const updatedRoom = fallback.getRoom(room_id, req.user.id);
              placements = updatedRoom?.placements || [];
            }
          }

          result = await executeFunction(fnName, args, room_id, placements, room, db);
        } catch (parseErr) {
          fnName = toolCall.function?.name;
          args = {};
          result = { success: false, message: 'Failed to parse function arguments' };
        }

        allActions.push({ function: fnName, args, result });

        llmMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      if (round === MAX_TOOL_ROUNDS - 1) {
        const finalResponse = await chat({ messages: llmMessages, systemPrompt });
        finalText = finalResponse.text;
      }
    }

    if (!finalText && allActions.length > 0) {
      const summaryRes = await chat({
        messages: [...llmMessages, { role: 'user', content: 'Summarize everything you just did in 1-2 sentences.' }],
        systemPrompt,
      });
      finalText = summaryRes.text;
    }

    // Save assistant response (skip for draft rooms)
    if (!isDraft) {
      if (db) {
        await supabaseAdmin.from('chat_messages').insert({
          room_id,
          role: 'assistant',
          content: finalText,
          tool_calls: allActions.length > 0 ? allActions : null,
        });
      } else {
        fallback.addChatMessage(room_id, {
          role: 'assistant',
          content: finalText,
          tool_calls: allActions.length > 0 ? allActions : null,
        });
      }
    }

    res.json({ message: finalText, actions: allActions, refresh: allActions.some(a => a.result?.refresh) });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
