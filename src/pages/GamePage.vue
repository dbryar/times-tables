<template>
  <q-page class="q-pa-md" :class="pageBackgroundColor">
    <!-- Circular progress for questions remaining -->
    <div class="progress-container">
      <q-circular-progress
        :value="questionsProgress"
        size="10vw"
        color="grey-8"
        track-color="purple-8"
        center-color="grey-5"
        :thickness="0.4"
        show-value
      >
        {{ questionsRemaining }}
      </q-circular-progress>

      <!-- Circular progress for time remaining -->
      <q-circular-progress
        :value="timeProgress"
        size="10vw"
        color="orange-9"
        track-color="grey-8"
        center-color="grey-5"
        reverse
        :thickness="0.4"
        show-value
      >
        {{ remainingTime }}
      </q-circular-progress>

      <!-- Score -->
      <q-circular-progress
        v-if="playerQuestions[currentQuestion]"
        :value="scoreProgress"
        size="10vw"
        color="green-6"
        track-color="grey-8"
        center-color="grey-5"
        :thickness="0.4"
        reverse
        show-value
      >
        {{ playerScore }}
      </q-circular-progress>
    </div>

    <!-- Main Question Display -->
    <q-card
      v-if="playerQuestions[currentQuestion]"
      class="q-pa-xl q-ma-md question-card"
      flat
      bordered
    >
      <div class="text-center q-mb-lg">
        <h2>{{ playerQuestions[currentQuestion]?.question ?? "" }}</h2>
      </div>

      <!-- Answer Input -->
      <q-input
        id="answer"
        v-model="playerAnswer"
        class="answer"
        input-class="answer-input"
        type="number"
        outlined
        :debounce
        :disabled="!inputEnabled"
      />
    </q-card>
    <q-card v-else class="q-pa-xl q-ma-md" flat bordered>
      <div class="text-h2 text-center text-dark">{{ playerScore }}!</div>
    </q-card>
  </q-page>
</template>

<script lang="ts">
import { Notify } from "quasar";
import { defineComponent, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { Difficulty, Language, Questions } from "@/models";
import { localStore, logger } from "@/services";

export default defineComponent({
  name: "GamePage",
  setup() {
    const debounce = 990;
    const questionsCount = 10;
    const backgroundDefault = "light-blue-3";
    const backgroundCorrect = "positive";
    const backgroundIncorrect = "negative";
    const timeLimit: Record<Difficulty, number> = {
      [Difficulty.EASY]: 10,
      [Difficulty.MEDIUM]: 9,
      [Difficulty.HARD]: 7,
      [Difficulty.EXPERT]: 5,
    };
    const correctScore: Record<Difficulty, number> = {
      [Difficulty.EASY]: 2,
      [Difficulty.MEDIUM]: 3,
      [Difficulty.HARD]: 5,
      [Difficulty.EXPERT]: 8,
    };
    const randomNumbers: Record<Difficulty, number[]> = {
      [Difficulty.EASY]: [2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 5, 6, 6, 7, 8, 9, 10, 11, 12],
      [Difficulty.MEDIUM]: [2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10, 11, 12],
      [Difficulty.HARD]: [2, 3, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 9, 10, 11, 11, 12, 14, 15],
      [Difficulty.EXPERT]: [3, 4, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11, 12, 12, 13, 14, 15],
    };

    const { params } = useRoute();
    const router = useRouter();
    const i18n = inject<(v: string | number, p?: Record<string, unknown>) => string>("i18n")!;
    const difficulty = params.difficulty as Difficulty;
    const highScores = localStore.get<Record<string, number>>("highScores", { Dan: 10 });
    const playerName = localStore.get<string>("player", "Player");
    const playerScore = ref(0);
    const playerTarget = highScores[playerName] || 0;
    const playerAnswer = ref(null);
    const questionTimer = ref<NodeJS.Timeout | null>(null);
    const remainingTime = ref(timeLimit[difficulty]);
    const currentQuestion = ref(0);
    const playerQuestions = reactive<Questions[]>([]);
    const inputEnabled = ref(false);
    const pageBackgroundColor = ref(`bg-${backgroundDefault}`);

    // TValues for circular progress bars
    const timeProgress = ref(100); // Starts at 100%
    const questionsRemaining = ref(questionsCount); // Total questions
    const questionsProgress = ref(0); // Fills as questions are completed
    const scoreProgress = ref(0); // Fills towards target as questions are completed

    const generateQuestion = () => {
      const numbers = randomNumbers[difficulty];
      let num1 = numbers[Math.floor(Math.random() * numbers.length)];
      let num2 = numbers[Math.floor(Math.random() * numbers.length)];

      playerQuestions.push({
        question: `${num1} x ${num2}`,
        correctAnswer: num1 * num2,
        playerAnswer: null,
        playerScore: 0,
      });

      inputEnabled.value = true;
    };

    const setTimer = () => {
      remainingTime.value = timeLimit[difficulty] ?? 5;
      timeProgress.value = 100;
      localStore.set("expiryTime", Date.now() + remainingTime.value * 1000);
      document.getElementById("answer")?.focus();
      checkTimer();
    };

    const checkTimer = () => {
      const currentTime = Date.now();
      const expiryTime = localStore.get<number>("expiryTime", currentTime);
      const timerHundreds = Math.round((expiryTime - currentTime) / 10);
      remainingTime.value = Math.max(0, Math.ceil(timerHundreds / 100));
      timeProgress.value = timerHundreds / timeLimit[difficulty];

      if (remainingTime.value == 0) {
        checkAnswer(true);
      } else {
        questionTimer.value = setTimeout(() => checkTimer(), 200); // Continue to check the timer
      }
    };

    const clearTimer = () => {
      if (questionTimer.value) {
        clearTimeout(questionTimer.value);
        questionTimer.value = null;
      }
    };

    const checkAnswer = async (check = inputEnabled.value) => {
      if (!check) return;
      if (currentQuestion.value < questionsCount) {
        inputEnabled.value = false;
        clearTimer();
        await new Promise((resolve) => setTimeout(resolve, playerAnswer.value ? 0 : debounce)); // let the debounce finish if the value is null
        const { question, correctAnswer } = playerQuestions[currentQuestion.value];
        logger.info(
          `${i18n(Language.messageCheckAnswer)} ${question}: ${
            playerAnswer.value
          } = ${correctAnswer}`
        );
        if (Number(playerAnswer.value) === Number(correctAnswer)) {
          logger.info(`${i18n(Language.messageCorrect)}!`);
          pageBackgroundColor.value = `bg-${backgroundCorrect}`;
          scoreAnswer();
          showNotification(true, question, correctAnswer);
        } else {
          logger.info(`${i18n(Language.messageIncorrect)}!`);
          pageBackgroundColor.value = `bg-${backgroundIncorrect}`;
          showNotification(false, question, correctAnswer);
        }
      }
      nextQuestion();
    };

    const scoreAnswer = () => {
      const score = Math.round(
        correctScore[difficulty] + (correctScore[difficulty] * timeProgress.value) / 200
      );
      playerQuestions[currentQuestion.value].playerScore = score;
      playerScore.value += score;
      updateTarget();
    };

    const updateTarget = () => {
      scoreProgress.value = Math.min((100 * playerScore.value) / playerTarget, 100);
    };

    const showNotification = (isCorrect: boolean, question: string, correctAnswer: number) => {
      Notify.create({
        message: `${i18n(
          isCorrect ? Language.messageCorrect : Language.messageIncorrect
        )}! ${question} = ${correctAnswer}`,
        color: isCorrect ? backgroundCorrect : backgroundIncorrect,
        position: "top-right",
        timeout: 2000,
      });
    };

    const nextQuestion = async () => {
      playerQuestions[currentQuestion.value].playerAnswer = playerAnswer.value;
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Delay for visual feedback
      advanceQuestionCount();
      pageBackgroundColor.value = `bg-${backgroundDefault}`;
      if (currentQuestion.value < questionsCount) {
        generateQuestion();
        setTimer();
      } else {
        endGame();
      }
    };

    const advanceQuestionCount = () => {
      currentQuestion.value++;
      questionsRemaining.value = questionsCount - currentQuestion.value;
      questionsProgress.value = (currentQuestion.value / questionsCount) * 100;
      playerAnswer.value = null;
    };

    // End game
    const endGame = () => {
      clearTimer();
      Notify.create({
        message: `${i18n(Language.messageGameOver)} ${playerScore.value}`,
        color: "blue",
        position: "top-right",
        timeout: 4000,
      });
      setTimeout(() => {
        if (playerScore.value > (highScores[playerName] || 0)) {
          Notify.create({
            message: i18n(Language.messageHighScore, { highScore: playerScore.value }),
            color: "positive",
            position: "top-right",
          });
          localStore.set("highScores", { ...highScores, [playerName]: playerScore.value });
        }
        localStore.set("lastGame", playerQuestions);
        router.push("/");
      }, 3000);
    };

    onMounted(() => {
      logger.info(i18n(Language.messageGameStart, { difficulty }));
      generateQuestion();
      setTimer();
    });

    watch(playerAnswer, (newVal) => {
      if (newVal) {
        checkAnswer();
      }
    });

    onBeforeUnmount(() => {
      clearTimer();
      localStorage.removeItem("expiryTime");
    });

    return {
      debounce,
      inputEnabled,
      questionsRemaining,
      questionsProgress,
      currentQuestion,
      playerQuestions,
      playerAnswer,
      playerScore,
      scoreProgress,
      remainingTime,
      timeProgress,
      pageBackgroundColor,
    };
  },
});
</script>

<style scoped>
.q-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.progress-container {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* Media query for mobile screens in portrait mode */
@media (max-width: 600px) {
  .progress-container {
    flex-direction: row;
    top: 10px;
    left: 10px;
    justify-content: space-around;
    width: 100%; /* Ensures the progress bars are spaced well on small screens */
    align-items: flex-start; /* Keeps alignment consistent */
  }
}

.score {
  font-size: 1.5rem;
  color: #000;
}

.question-card {
  margin: 0 auto;
  width: 100%;
  max-width: 600px;
}

@media (max-width: 600px) {
  .question-card {
    margin-bottom: 40vh; /* Maintain space at the bottom for mobile screens */
  }
}

h2 {
  font-size: clamp(1rem, 16vw, 5rem);
}

.answer {
  text-align: center;
  font-size: clamp(1rem, 8vw, 3rem);
}

.answer-input {
  font-size: inherit;
}
</style>
