-- CreateEnum
CREATE TYPE "papel" AS ENUM ('aluno', 'professor', 'admin');

-- CreateEnum
CREATE TYPE "area_enem" AS ENUM ('matematica', 'linguagens', 'ciencias_humanas', 'ciencias_natureza');

-- CreateEnum
CREATE TYPE "status_redacao" AS ENUM ('pendente', 'corrigida');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "papel" NOT NULL DEFAULT 'aluno',
    "meta_questoes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "enem_id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "area" "area_enem",
    "disciplina" TEXT,
    "idioma" TEXT DEFAULT 'portugues',
    "titulo" TEXT NOT NULL,
    "enunciado" TEXT,
    "introducao_alternativas" TEXT,
    "arquivos" JSONB NOT NULL DEFAULT '[]',
    "alternativas" JSONB NOT NULL,
    "gabarito" TEXT NOT NULL,
    "dados_originais" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essays" (
    "id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "professor_id" UUID,
    "tema" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "status_redacao" NOT NULL DEFAULT 'pendente',
    "nota" INTEGER,
    "feedback" TEXT,
    "enviada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corrigida_em" TIMESTAMP(3),

    CONSTRAINT "essays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "resposta_dada" TEXT NOT NULL,
    "correta" BOOLEAN NOT NULL,
    "respondida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questions_enem_id_key" ON "questions"("enem_id");

-- CreateIndex
CREATE INDEX "questions_ano_area_idioma_idx" ON "questions"("ano", "area", "idioma");

-- CreateIndex
CREATE INDEX "essays_status_idx" ON "essays"("status");

-- CreateIndex
CREATE INDEX "essays_aluno_id_idx" ON "essays"("aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_attempts_aluno_id_question_id_key" ON "question_attempts"("aluno_id", "question_id");

-- AddForeignKey
ALTER TABLE "essays" ADD CONSTRAINT "essays_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essays" ADD CONSTRAINT "essays_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
