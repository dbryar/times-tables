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
        value-style="font-size: 1.5rem; color: white;"
      >
        {{ questionsRemaining }}
      </q-circular-progress>

      <!-- Circular progress for time remaining -->
      <q-circular-progress
        :value="timeProgress"
        size="10vw"
        color="orange-9"
        track-color="grey-8"
        reverse
        :thickness="1"
      >
      </q-circular-progress>

      <!-- Score -->
      <div v-if="playerQuestions[currentQuestion]" class="score text-h5 text-center q-ma-md">
        {{ playerScore }}
      </div>
    </div>

    <!-- Main Question Display -->
    <q-card v-if="playerQuestions[currentQuestion]" class="q-pa-xl q-ma-md" flat bordered>
      <div class="text-h2 text-center q-mb-lg">
        {{ playerQuestions[currentQuestion]?.question ?? "" }}
      </div>

      <!-- Answer Input -->
      <q-input v-model="playerAnswer" autofocus type="number" outlined :debounce />
    </q-card>
    <q-card v-else class="q-pa-xl q-ma-md" flat bordered>
      <div class="text-h2 text-center text-dark">{{ playerScore }}!</div>
    </q-card>
  </q-page>
</template>

<script lang="ts">
import { Notify } from "quasar";
import { defineComponent, inject, onMounted, reactive, ref, watch } from "vue";
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
    const playerName = localStore.get<string>("player", "Player");
    const playerScore = ref(0);
    const playerAnswer = ref(null);
    const remainingTime = ref(timeLimit[difficulty]);
    const currentQuestion = ref(0);
    const playerQuestions = reactive<Questions[]>([]);
    const timer = ref<NodeJS.Timeout | null>(null);
    const inputEnabled = ref(false);
    const pageBackgroundColor = ref(`bg-${backgroundDefault}`);
    const highScores = localStore.get<Record<string, number>>("highScores", { Dan: 10 });

    // Time and question progress for circular progress bars
    const timeProgress = ref(100); // Starts at 100%
    const questionsRemaining = ref(questionsCount); // Total questions
    const questionsProgress = ref(0); // Fills as questions are completed

    // Generate random question
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

    // Check the answer
    const checkAnswer = async (check = inputEnabled.value) => {
      if (!check) return;
      if (currentQuestion.value < questionsCount) {
        clearTimer();
        inputEnabled.value = false;
        await new Promise((resolve) => setTimeout(resolve, debounce)); // let the debounce finish
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

    // score the answer
    const scoreAnswer = () => {
      const score = Math.round(
        correctScore[difficulty] + (correctScore[difficulty] * timeProgress.value) / 200
      );
      playerQuestions[currentQuestion.value].playerScore = score;
      playerScore.value += score;
    };

    // Show notification bubble
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

    // Move to next question
    const nextQuestion = async () => {
      playerQuestions[currentQuestion.value].playerAnswer = playerAnswer.value;
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Delay for visual feedback
      advanceQuestionCount();
      pageBackgroundColor.value = `bg-${backgroundDefault}`;
      if (currentQuestion.value < questionsCount) {
        generateQuestion();
        startTimer();
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

    // Start the timer
    const startTimer = () => {
      remainingTime.value = timeLimit[difficulty] || 5;
      timeProgress.value = 100;

      timer.value = setInterval(() => {
        if (remainingTime.value > 0) {
          remainingTime.value--;
          timeProgress.value = (remainingTime.value / timeLimit[difficulty]) * 100;
        } else {
          checkAnswer(true); // auto-check if timer runs out
        }
      }, 1000);
    };

    // Reset the timer
    const clearTimer = () => {
      if (timer.value) clearInterval(timer.value);
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
            message: i18n(Language.messageHighScore, { highscore: playerScore.value }),
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
      startTimer();
    });

    watch(playerAnswer, (newVal) => {
      if (newVal) {
        checkAnswer();
      }
    });

    return {
      debounce,
      questionsRemaining,
      questionsProgress,
      currentQuestion,
      playerQuestions,
      playerAnswer,
      playerScore,
      remainingTime,
      timeProgress,
      pageBackgroundColor,
      checkAnswer,
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
</style>
