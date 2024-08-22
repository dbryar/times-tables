<template>
  <q-page class="q-pa-md">
    <q-card class="q-ma-md" flat bordered>
      <q-card-section>
        <div class="text-h2 text-center">{{ render(Language.headingMainPage) }}</div>
      </q-card-section>

      <q-card-section>
        <div class="text-h6">{{ render(Language.headingHighScores) }}</div>
        <q-list bordered>
          <q-item v-for="([player, score], index) in topScores()" :key="index">
            <q-item-section># {{ index + 1 }}</q-item-section>
            <q-item-section>{{ score }}</q-item-section>
            <q-item-section>{{ player }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section>
        <div class="text-h6">{{ render(Language.headingPlayerName) }}</div>
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

      <q-card-section>
        <div class="text-h6">{{ render(Language.headingLastGame) }}</div>
        <q-list bordered>
          <q-item
            dense
            v-for="({ question, correctAnswer, playerAnswer }, index) in lastGame"
            :key="index"
          >
            <q-item-section>{{ question }}</q-item-section>
            <q-item-section>{{ playerAnswer ?? "?" }}</q-item-section>
            <q-item-section>{{
              playerAnswer == correctAnswer ? "✅" : `❌ (${correctAnswer})`
            }}</q-item-section>
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
      render: (v?: string | number) => {
        if (!v && v !== 0) return "";
        return typeof v === "number" ? i18n(v) : v;
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
      localStore.set("player", newVal);
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
