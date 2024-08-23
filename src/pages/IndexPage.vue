<template>
  <q-page class="q-pa-md">
    <q-card class="q-ma-md" flat bordered>
      <q-card-section>
        <div class="text-h3 text-center text-primary">{{ render(Language.headingMainPage) }}</div>
      </q-card-section>

      <q-card-section>
        <div class="text-h6 text-deep-purple">{{ render(Language.headingHighScores) }}</div>
        <q-list bordered dense>
          <q-item
            v-for="([player, score], index) in topScores()"
            :key="index"
            :class="hsColour(index)"
          >
            <q-item-section># {{ index + 1 }}</q-item-section>
            <q-item-section>{{ score }}</q-item-section>
            <q-item-section>{{ player }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section>
        <div class="text-h6 text-deep-purple">{{ render(Language.headingPlayerName) }}</div>
        <div>
          <q-input v-model="playerName" outlined debounce="700" />
        </div>
      </q-card-section>

      <q-card-actions align="center" class="q-py-md">
        <q-btn label="Easy" color="green" @click="startGame(Difficulty.EASY)" />
        <q-btn label="Medium" color="orange" @click="startGame(Difficulty.MEDIUM)" />
        <q-btn label="Hard" color="red" @click="startGame(Difficulty.HARD)" />
        <q-btn label="Expert" color="negative" @click="startGame(Difficulty.EXPERT)" />
      </q-card-actions>

      <q-card-section v-if="lastGame.length">
        <div class="text-h6 text-deep-purple">{{ render(Language.headingLastGame) }}</div>
        <q-list bordered>
          <q-item
            dense
            v-for="({ question, correctAnswer, playerAnswer, playerScore }, index) in lastGame"
            :key="index"
          >
            <q-item-section class="text-center question" no-wrap>
              <span>{{ splitQuestion(question).first }}</span>
              <span class="operator">x</span>
              <span>{{ splitQuestion(question).last }}</span>
            </q-item-section>
            <q-item-section class="text-center">{{ playerAnswer ?? "?" }}</q-item-section>
            <q-item-section no-wrap
              >&nbsp;{{
                playerAnswer == correctAnswer ? `✅ ( +${playerScore} )` : `❌ [ ${correctAnswer} ]`
              }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script lang="ts">
import { defineComponent, inject, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { Difficulty, Language, Questions } from "@/models";
import { localStore } from "@/services";

export default defineComponent({
  name: "IndexPage",
  setup() {
    const router = useRouter();
    const highScores = localStore.get<Record<string, number>>("highScores", { Dan: 10 });
    const lastGame = localStore.get<Questions[]>("lastGame", []);
    const playerName = ref(localStore.get<string>("player", ""));
    const i18n = inject<(v: string | number, p?: Record<string, unknown>) => string>("i18n")!;
    const fn = {
      hsColour: (index: number) => {
        if (index > 2) return "bg-white";
        return `bg-green-${5 - 2 * index}`;
      },
      render: (v?: string | number) => {
        if (!v && v !== 0) return "";
        return typeof v === "number" ? i18n(v) : v;
      },
      splitQuestion: (question: string) => {
        const parts = question.split("x");
        const first = parts.shift()?.trim() ?? "";
        const last = parts.pop()?.trim() ?? "";
        return { first, last };
      },
      startGame: (difficulty: string) => {
        router.push(difficulty);
      },
      topScores: () =>
        Object.entries(highScores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
    };

    watch(playerName, (newVal) => {
      localStore.set("player", newVal.trim());
    });

    return {
      ...fn,
      playerName,
      lastGame,
      Difficulty,
      Language,
    };
  },
});
</script>
<style lang="scss" scoped>
.question {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 1px;
}

.question > span {
  min-width: 1.6rem;
}

.operator {
  min-width: 0.5rem !important;
}
</style>
