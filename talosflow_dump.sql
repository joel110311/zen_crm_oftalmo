--
-- PostgreSQL database dump
--

\restrict dHIabCWEHr5fDfuG2bBxUsg50WE96olrgG5OdKZ61NvKOZyTAhMcCkPAsQaCLma

-- Dumped from database version 15.15 (Debian 15.15-1.pgdg12+1)
-- Dumped by pg_dump version 15.15 (Debian 15.15-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."StageAutomation" DROP CONSTRAINT IF EXISTS "StageAutomation_tagId_fkey";
ALTER TABLE IF EXISTS ONLY public."StageAutomation" DROP CONSTRAINT IF EXISTS "StageAutomation_stageId_fkey";
ALTER TABLE IF EXISTS ONLY public."Message" DROP CONSTRAINT IF EXISTS "Message_conversationId_fkey";
ALTER TABLE IF EXISTS ONLY public."Deal" DROP CONSTRAINT IF EXISTS "Deal_stageId_fkey";
ALTER TABLE IF EXISTS ONLY public."Deal" DROP CONSTRAINT IF EXISTS "Deal_contactId_fkey";
ALTER TABLE IF EXISTS ONLY public."DealTag" DROP CONSTRAINT IF EXISTS "DealTag_tagId_fkey";
ALTER TABLE IF EXISTS ONLY public."DealTag" DROP CONSTRAINT IF EXISTS "DealTag_dealId_fkey";
ALTER TABLE IF EXISTS ONLY public."Conversation" DROP CONSTRAINT IF EXISTS "Conversation_contactId_fkey";
ALTER TABLE IF EXISTS ONLY public."Appointment" DROP CONSTRAINT IF EXISTS "Appointment_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Appointment" DROP CONSTRAINT IF EXISTS "Appointment_contactId_fkey";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."Tag_name_key";
DROP INDEX IF EXISTS public."DealTag_dealId_tagId_key";
DROP INDEX IF EXISTS public."Contact_phone_key";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."Template" DROP CONSTRAINT IF EXISTS "Template_pkey";
ALTER TABLE IF EXISTS ONLY public."Tag" DROP CONSTRAINT IF EXISTS "Tag_pkey";
ALTER TABLE IF EXISTS ONLY public."SystemSettings" DROP CONSTRAINT IF EXISTS "SystemSettings_pkey";
ALTER TABLE IF EXISTS ONLY public."StageAutomation" DROP CONSTRAINT IF EXISTS "StageAutomation_pkey";
ALTER TABLE IF EXISTS ONLY public."PipelineStage" DROP CONSTRAINT IF EXISTS "PipelineStage_pkey";
ALTER TABLE IF EXISTS ONLY public."Message" DROP CONSTRAINT IF EXISTS "Message_pkey";
ALTER TABLE IF EXISTS ONLY public."Document" DROP CONSTRAINT IF EXISTS "Document_pkey";
ALTER TABLE IF EXISTS ONLY public."Deal" DROP CONSTRAINT IF EXISTS "Deal_pkey";
ALTER TABLE IF EXISTS ONLY public."DealTag" DROP CONSTRAINT IF EXISTS "DealTag_pkey";
ALTER TABLE IF EXISTS ONLY public."Conversation" DROP CONSTRAINT IF EXISTS "Conversation_pkey";
ALTER TABLE IF EXISTS ONLY public."Contact" DROP CONSTRAINT IF EXISTS "Contact_pkey";
ALTER TABLE IF EXISTS ONLY public."Appointment" DROP CONSTRAINT IF EXISTS "Appointment_pkey";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."Template";
DROP TABLE IF EXISTS public."Tag";
DROP TABLE IF EXISTS public."SystemSettings";
DROP TABLE IF EXISTS public."StageAutomation";
DROP TABLE IF EXISTS public."PipelineStage";
DROP TABLE IF EXISTS public."Message";
DROP TABLE IF EXISTS public."Document";
DROP TABLE IF EXISTS public."DealTag";
DROP TABLE IF EXISTS public."Deal";
DROP TABLE IF EXISTS public."Conversation";
DROP TABLE IF EXISTS public."Contact";
DROP TABLE IF EXISTS public."Appointment";
DROP TYPE IF EXISTS public."Role";
DROP EXTENSION IF EXISTS vector;
--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN',
    'AGENT'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Appointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Appointment" (
    id text NOT NULL,
    title text NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    "contactId" text,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Contact" (
    id text NOT NULL,
    phone text NOT NULL,
    name text,
    email text,
    tags text[],
    status text DEFAULT 'lead'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    company text,
    "lastName" text,
    role text
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id text NOT NULL,
    "contactId" text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isFavorite" boolean DEFAULT false NOT NULL,
    "isGroup" boolean DEFAULT false NOT NULL,
    "isMuted" boolean DEFAULT false NOT NULL
);


--
-- Name: Deal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Deal" (
    id text NOT NULL,
    title text NOT NULL,
    value double precision DEFAULT 0 NOT NULL,
    "contactId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assignedTo" text,
    notes text,
    priority text DEFAULT 'medium'::text NOT NULL,
    source text DEFAULT 'whatsapp'::text NOT NULL,
    "stageId" text NOT NULL
);


--
-- Name: DealTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DealTag" (
    id text NOT NULL,
    "dealId" text NOT NULL,
    "tagId" text NOT NULL
);


--
-- Name: Document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    direction text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mediaFileName" text,
    "mediaType" text,
    "mediaUrl" text
);


--
-- Name: PipelineStage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PipelineStage" (
    id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#64748B'::text NOT NULL,
    "order" integer NOT NULL,
    "isIncoming" boolean DEFAULT false NOT NULL,
    "isClosedWon" boolean DEFAULT false NOT NULL,
    "isClosedLost" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StageAutomation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StageAutomation" (
    id text NOT NULL,
    "stageId" text NOT NULL,
    trigger text DEFAULT 'on_enter'::text NOT NULL,
    action text NOT NULL,
    "tagId" text NOT NULL,
    "applyAll" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SystemSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSettings" (
    id text NOT NULL,
    "openaiApiKey" text,
    "geminiApiKey" text,
    "ycloudApiKey" text,
    "ycloudPhoneId" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isBotEnabled" boolean DEFAULT false NOT NULL,
    "n8nWebhookUrl" text
);


--
-- Name: Tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tag" (
    id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#64748B'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Template" (
    id text NOT NULL,
    name text NOT NULL,
    content text NOT NULL,
    category text,
    language text DEFAULT 'es'::text NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    password text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Data for Name: Appointment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Appointment" (id, title, "startTime", "endTime", status, notes, "contactId", "userId", "createdAt", "updatedAt") FROM stdin;
cmlncaiue000370vv2tlldw6x	Reunión con Joel Venegas	2026-02-16 15:00:00	2026-02-16 15:30:00	scheduled		cmlhlafhd0004lgvvjfwxftlx	\N	2026-02-15 06:03:27.589	2026-02-16 06:46:19.426
\.


--
-- Data for Name: Contact; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Contact" (id, phone, name, email, tags, status, "createdAt", "updatedAt", company, "lastName", role) FROM stdin;
cmlfpfscy0000i4vvifc9wjcp	524772683928	Joel Venegas	\N	\N	active	2026-02-09 21:49:18.787	2026-02-09 21:49:18.787	\N	\N	\N
cmlhlafhd0004lgvvjfwxftlx	524794559238	Joel Venegas		\N	lead	2026-02-11 05:28:42.721	2026-02-15 04:52:50.639		\N	
cmlin3sit0002qsvv955o22nk	524771737217	Alan		\N	lead	2026-02-11 23:07:18.437	2026-02-15 04:13:50.886		\N	\N
\.


--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Conversation" (id, "contactId", status, "createdAt", "updatedAt", "isFavorite", "isGroup", "isMuted") FROM stdin;
cmlin3sj20003qsvvvin0xfa5	cmlin3sit0002qsvv955o22nk	active	2026-02-11 23:07:18.445	2026-02-11 23:07:18.453	f	f	f
cmlhlafik0005lgvv01htwg74	cmlhlafhd0004lgvvjfwxftlx	active	2026-02-11 05:28:42.764	2026-02-15 04:57:48.793	f	f	f
conv-joel-1	cmlfpfscy0000i4vvifc9wjcp	active	2026-02-09 21:49:18.84	2026-02-15 07:25:42.524	f	f	f
\.


--
-- Data for Name: Deal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Deal" (id, title, value, "contactId", "createdAt", "updatedAt", "assignedTo", notes, priority, source, "stageId") FROM stdin;
cmlipso7g0004b4vvi567mhce	Test Lead	100	\N	2026-02-12 00:22:38.469	2026-02-12 00:25:35.177	\N	\N	medium	manual	cmlimohld00062svvnqhyd571
cmliqcne20007b4vv2s94indz	Lead - Joel Venegas	500	cmlhlafhd0004lgvvjfwxftlx	2026-02-12 00:38:10.538	2026-02-15 04:43:14.972	\N	\N	medium	whatsapp	cmlimohil00002svvhemqw2u3
cmlnem7ky000670vvfaqfr2zz	Lead - Joel Venegas	0	cmlfpfscy0000i4vvifc9wjcp	2026-02-15 07:08:32.098	2026-02-15 07:08:32.098	\N	\N	medium	whatsapp	cmlimohil00002svvhemqw2u3
\.


--
-- Data for Name: DealTag; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DealTag" (id, "dealId", "tagId") FROM stdin;
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Document" (id, title, content, embedding, "createdAt", "updatedAt") FROM stdin;
cmlne5xj7000470vvxpkl2jm9	Prompt Maestro de AntiGravity.pdf	Mock content for Prompt Maestro de AntiGravity.pdf	\N	2026-02-15 06:55:52.579	2026-02-15 06:55:52.579
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Message" (id, "conversationId", content, type, direction, status, "createdAt", "mediaFileName", "mediaType", "mediaUrl") FROM stdin;
cmlfpfses0001i4vv67d2ls0z	conv-joel-1	¡Hola! Este es un mensaje de prueba.	text	inbound	delivered	2026-02-09 21:49:18.868	\N	\N	\N
cmlfpqf7z0002i4vvxd11deuc	conv-joel-1	hola	text	inbound	delivered	2026-02-09 21:57:34.99	\N	\N	\N
cmlfpqmjc0003i4vv2cxb7tem	conv-joel-1	hola	text	outbound	sent	2026-02-09 21:57:44.472	\N	\N	\N
cmlfrmc01000094vvkc7cst2c	conv-joel-1	[Imagen]	image	inbound	delivered	2026-02-09 22:50:23.425	\N	image/jpeg	https://api.ycloud.com/v2/whatsapp/media/download/3926611280970826?sig=t%3D1770677421%2Cs%3Dbf754c9fa96b0a0e5072fd8bb23c950e340a5359e9fa077b8ba038a8da6e1aa8&payload=eyJpZCI6IjM5MjY2MTEyODA5NzA4MjYiLCJ3YWJhSWQiOiIxMzMyNzczMTY0OTU3MTAzIiwid2FtaWQiOiJ3YW1pZC5IQmdOTlRJeE5EYzNNalk0TXpreU9CVUNBQklZRmpORlFqQTJRemRCTWtVeE1FVTRORVl5TWpnMk5USUEiLCJtaW1lVHlwZSI6ImltYWdlL2pwZWciLCJzaGEyNTYiOiJzQ0czMHZVbnowMkt4dytpalJBTEFLSVlwanByTEplYWFPem9EVlM1Y3gwPSJ9
cmlfrmtf0000194vv1txezz54	conv-joel-1	[image]	image	outbound	failed	2026-02-09 22:50:45.996	Pulseras Glow Sync.jpeg	image/jpeg	http://localhost:3000/uploads/1770677440242-tumo7j.jpeg
cmlfrrdxl000294vvi5kscfsv	conv-joel-1	[image]	image	outbound	sent	2026-02-09 22:54:19.208	Pulseras Glow Sync.jpeg	image/jpeg	http://localhost:3000/uploads/1770677655632-c6k8xo.jpeg
cmlfsgj5l000394vvc793ggle	conv-joel-1	[audio]	audio	outbound	sent	2026-02-09 23:13:52.376	voice-note-1770678832241.webm	audio/webm	http://localhost:3000/uploads/1770678832303-rvu1fm.webm
cmlftxijr0000ygvvuc4e0zq0	conv-joel-1	[audio]	audio	outbound	sent	2026-02-09 23:55:04.358	nota-de-voz-1770681303912.webm	audio/webm	http://localhost:3000/uploads/1770681304126-faaqlm.webm
cmlfw1lbd0000dcvvm6wq94yf	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 00:54:13.8	nota-de-voz-1770684853331.m4a	audio/mp4	http://localhost:3000/uploads/1770684853512-f5vbbg.m4a
cmlgxcc3f0001ekvvregfhwab	conv-joel-1	[Audio]	audio	inbound	delivered	2026-02-10 18:18:20.859	\N	audio/ogg	https://api.ycloud.com/v2/whatsapp/media/download/2067604704095048?sig=t%3D1770747498%2Cs%3D776aecd492aca09bde9f32cde91c6b91c53642227d1fd7c23a2104fa64063b1b&payload=eyJpZCI6IjIwNjc2MDQ3MDQwOTUwNDgiLCJ3YWJhSWQiOiIxMzMyNzczMTY0OTU3MTAzIiwid2FtaWQiOiJ3YW1pZC5IQmdOTlRJeE5EYzNNalk0TXpreU9CVUNBQklZRmpORlFqQkVSamhCTmtZeU5rUXhRa1k1TVVRMk5UY0EiLCJtaW1lVHlwZSI6ImF1ZGlvL29nZzsgY29kZWNzPW9wdXMiLCJzaGEyNTYiOiJxWWF6cTY5VkRYL1dPa05sYmtnb0ZackxaUFhVaTJuQTlnZDdHelJ4VHVFPSJ9
cmlgxdmwb0002ekvvzo158v1p	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 18:19:21.515	nota-de-voz-1770747561204.m4a	audio/mp4	http://localhost:3000/uploads/1770747561297-dc0n2f.m4a
cmlgxemdx0003ekvvoc3bjl7j	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 18:20:07.509	nota-de-voz-1770747607378.m4a	audio/mp4	http://localhost:3000/uploads/1770747607408-19rgco.m4a
cmlgxpb360004ekvvjasqtepr	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 18:28:26.081	nota-de-voz-1770748105759.m4a	audio/mp4	http://localhost:3000/uploads/1770748105802-tz13wc.m4a
cmlgy51em0000owvv6pdu4euq	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 18:40:40.029	nota-de-voz-1770748839801.m4a	audio/mp4	http://localhost:3000/uploads/1770748839870-1qv7tk.m4a
cmlgyc8fv0001owvvr9ihji21	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 18:46:15.738	nota-de-voz-1770749175564.m4a	audio/mp4	http://localhost:3000/uploads/1770749175601-ho9a48.m4a
cmlgymcp400009wvv1rxxujiu	conv-joel-1	[audio]	audio	outbound	failed	2026-02-10 18:54:07.815	nota-de-voz-1770749647354.m4a	audio/mp4	http://localhost:3000/uploads/1770749647427-crdcap.m4a
cmlgypb3v00019wvv29kv9wrf	conv-joel-1	[audio]	audio	outbound	failed	2026-02-10 18:56:25.722	nota-de-voz-1770749785429.m4a	audio/mp4	http://localhost:3000/uploads/1770749785472-alusem.m4a
cmlgytlp100029wvv71u9syic	conv-joel-1	[audio]	audio	outbound	sent	2026-02-10 18:59:46.069	nota-de-voz-1770749985771.m4a	audio/mp4	http://localhost:3000/uploads/1770749985806-ws65as.m4a
cmlh99fao0000jsvvaasthree	conv-joel-1	hola	text	inbound	delivered	2026-02-10 23:52:00.431	\N	\N	\N
cmlh99irr0001jsvv0wnx423l	conv-joel-1	hola	text	outbound	sent	2026-02-10 23:52:04.935	\N	\N	\N
cmlh9j2wh0002jsvv4m94nfyn	conv-joel-1	[audio]	audio	outbound	failed	2026-02-10 23:59:30.928	nota-de-voz-1770767970619.ogg	audio/ogg; codecs=opus	http://localhost:3000/uploads/1770767970734-garruh.ogg
cmlhbwetq0000acvvof8d1hb3	conv-joel-1	[audio]	audio	outbound	failed	2026-02-11 01:05:52.141	nota-de-voz-1770771951562.ogg	audio/ogg; codecs=opus	http://localhost:3000/uploads/1770771951652-kqzgk.ogg
cmlhbxidz0001acvvr6j1vf5h	conv-joel-1	[audio]	audio	outbound	sent	2026-02-11 01:06:43.415	nota-de-voz-1770772003158.ogg	audio/ogg; codecs=opus	http://localhost:3000/uploads/1770772003186-dh698f.ogg
cmlhc16t30002acvvti2g6h7z	conv-joel-1	[audio]	audio	outbound	sent	2026-02-11 01:09:35.03	nota-de-voz-1770772174624.ogg	audio/ogg; codecs=opus	http://localhost:3000/uploads/1770772174661-cl5e14.ogg
cmlhkmldz0000lgvv52rd8olf	conv-joel-1	hola	text	inbound	delivered	2026-02-11 05:10:10.63	\N	\N	\N
cmlhkmm4e0001lgvva948q3hr	conv-joel-1	como	text	inbound	delivered	2026-02-11 05:10:11.582	\N	\N	\N
cmlhkmmww0002lgvverons4sf	conv-joel-1	estas	text	inbound	delivered	2026-02-11 05:10:12.608	\N	\N	\N
cmlhlafj40006lgvv65x6hxid	cmlhlafik0005lgvv01htwg74	Hola	text	inbound	delivered	2026-02-11 05:28:42.783	\N	\N	\N
cmlhld1wj0007lgvv8l9u4f28	conv-joel-1	hola	text	inbound	delivered	2026-02-11 05:30:45.091	\N	\N	\N
cmlhldazd0008lgvv8qyhn4d9	conv-joel-1	Que tal que pasa?	text	outbound	sent	2026-02-11 05:30:56.857	\N	\N	\N
cmlhliiyd0009lgvvbtqutt8f	conv-joel-1	hola	text	inbound	delivered	2026-02-11 05:35:00.468	\N	\N	\N
cmlhlik9o000algvvq33kigka	conv-joel-1	claro	text	inbound	delivered	2026-02-11 05:35:02.172	\N	\N	\N
cmlhlobur000blgvv69bodats	conv-joel-1	hola	text	inbound	delivered	2026-02-11 05:39:31.203	\N	\N	\N
cmlimohmn00072svvz7bfvbnb	conv-joel-1	¡Hola! Este es un mensaje de prueba.	text	inbound	delivered	2026-02-11 22:55:24.479	\N	\N	\N
cmlimvnhq0000qsvv9x6t8d9c	conv-joel-1	Hola	text	inbound	delivered	2026-02-11 23:00:58.67	\N	\N	\N
cmlin15bt0001qsvve4cipz1f	conv-joel-1	hola	text	inbound	delivered	2026-02-11 23:05:15.064	\N	\N	\N
cmlin3sj60004qsvvmnv4f7e2	cmlin3sj20003qsvvvin0xfa5	que pasa tío	text	inbound	delivered	2026-02-11 23:07:18.45	\N	\N	\N
cmlipu7550005b4vvhtqc4ah1	conv-joel-1	Hola Tio	text	inbound	delivered	2026-02-12 00:23:49.673	\N	\N	\N
cmliqcndn0006b4vv651klsby	cmlhlafik0005lgvv01htwg74	Hola	text	inbound	delivered	2026-02-12 00:38:10.523	\N	\N	\N
cmln9uycw000070vv9t38k98n	cmlhlafik0005lgvv01htwg74	[document]	document	outbound	sent	2026-02-15 04:55:21.968	Prompt Maestro de AntiGravity.pdf	application/pdf	http://localhost:3000/uploads/1771131321902-aacl9.pdf
cmln9xrfz000170vvos3hmayw	cmlhlafik0005lgvv01htwg74	Hola	text	inbound	delivered	2026-02-15 04:57:32.975	\N	\N	\N
cmln9y2g3000270vvpfvze2aa	cmlhlafik0005lgvv01htwg74	[document]	document	outbound	sent	2026-02-15 04:57:47.235	Prompt Maestro de AntiGravity.pdf	application/pdf	http://localhost:3000/uploads/1771131467203-1gngg2.pdf
cmlnem7ka000570vvipjpdcf4	conv-joel-1	Hola	text	inbound	delivered	2026-02-15 07:08:32.073	\N	\N	\N
cmlnf1bsk00001kvvv0vbivp8	conv-joel-1	hola	text	inbound	delivered	2026-02-15 07:20:17.395	\N	\N	\N
cmlnf89qk00011kvv7kseicyp	conv-joel-1	hola	text	outbound	sent	2026-02-15 07:25:41.324	\N	\N	\N
\.


--
-- Data for Name: PipelineStage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PipelineStage" (id, name, color, "order", "isIncoming", "isClosedWon", "isClosedLost", "createdAt", "updatedAt") FROM stdin;
cmlimohil00002svvhemqw2u3	Nuevo Lead	#2563EB	0	t	f	f	2026-02-11 22:55:24.332	2026-02-11 22:55:24.332
cmlimohjn00022svvotwddrs9	Calificado	#EAB308	1	f	f	f	2026-02-11 22:55:24.371	2026-02-11 22:55:24.371
cmlimohk100032svv7qkgfz27	Propuesta	#8B5CF6	2	f	f	f	2026-02-11 22:55:24.384	2026-02-11 22:55:24.384
cmlimohkk00042svvryzgqqpp	Negociación	#F97316	3	f	f	f	2026-02-11 22:55:24.404	2026-02-11 22:55:24.404
cmlimohky00052svvhbhhyqzl	Cerrado Ganado	#22C55E	4	f	t	f	2026-02-11 22:55:24.418	2026-02-11 22:55:24.418
cmlimohld00062svvnqhyd571	Cerrado Perdido	#EF4444	5	f	f	t	2026-02-11 22:55:24.433	2026-02-11 22:55:24.433
\.


--
-- Data for Name: StageAutomation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StageAutomation" (id, "stageId", trigger, action, "tagId", "applyAll", "createdAt") FROM stdin;
\.


--
-- Data for Name: SystemSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemSettings" (id, "openaiApiKey", "geminiApiKey", "ycloudApiKey", "ycloudPhoneId", "updatedAt", "isBotEnabled", "n8nWebhookUrl") FROM stdin;
default	sk-proj-placeholder-for-security	AIzaSyBff9vkGbUC8HNr_gX14TH75GPvprKJoZ8	b5df62fc3757e5f7ab51166591c6645c	+524771075025	2026-02-15 07:19:49.233	t	https://n8nla.logicapp.net/webhook/dental
\.


--
-- Data for Name: Tag; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Tag" (id, name, color, "createdAt") FROM stdin;
cmliorq500000b4vvm824lff6	logo	#2563EB	2026-02-11 23:53:54.708
cmliorzk10002b4vvgsrrj1xv	pasarela	#0891B2	2026-02-11 23:54:06.913
cmln89hy600090gvvoverobxz	logos	#2563EB	2026-02-15 04:10:41.31
\.


--
-- Data for Name: Template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Template" (id, name, content, category, language, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, name, password, role, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: Appointment Appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY (id);


--
-- Name: Contact Contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_pkey" PRIMARY KEY (id);


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: DealTag DealTag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealTag"
    ADD CONSTRAINT "DealTag_pkey" PRIMARY KEY (id);


--
-- Name: Deal Deal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: PipelineStage PipelineStage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PipelineStage"
    ADD CONSTRAINT "PipelineStage_pkey" PRIMARY KEY (id);


--
-- Name: StageAutomation StageAutomation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StageAutomation"
    ADD CONSTRAINT "StageAutomation_pkey" PRIMARY KEY (id);


--
-- Name: SystemSettings SystemSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSettings"
    ADD CONSTRAINT "SystemSettings_pkey" PRIMARY KEY (id);


--
-- Name: Tag Tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_pkey" PRIMARY KEY (id);


--
-- Name: Template Template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Contact_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Contact_phone_key" ON public."Contact" USING btree (phone);


--
-- Name: DealTag_dealId_tagId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DealTag_dealId_tagId_key" ON public."DealTag" USING btree ("dealId", "tagId");


--
-- Name: Tag_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tag_name_key" ON public."Tag" USING btree (name);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Appointment Appointment_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appointment Appointment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Conversation Conversation_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DealTag DealTag_dealId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealTag"
    ADD CONSTRAINT "DealTag_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DealTag DealTag_tagId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealTag"
    ADD CONSTRAINT "DealTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Deal Deal_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_stageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES public."PipelineStage"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StageAutomation StageAutomation_stageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StageAutomation"
    ADD CONSTRAINT "StageAutomation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES public."PipelineStage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StageAutomation StageAutomation_tagId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StageAutomation"
    ADD CONSTRAINT "StageAutomation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dHIabCWEHr5fDfuG2bBxUsg50WE96olrgG5OdKZ61NvKOZyTAhMcCkPAsQaCLma

