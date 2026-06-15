import { PatientWorkspace } from "@/components/patients/patient-workspace";
import { getPatientWorkspace } from "@/app/actions/patients";

export default async function PatientsPage({
    searchParams,
}: {
    searchParams?: Promise<{ patientId?: string | string[]; query?: string | string[] }>;
}) {
    const resolvedSearchParams = await searchParams;
    const patientIdValue = resolvedSearchParams?.patientId;
    const queryValue = resolvedSearchParams?.query;
    const patientId = Array.isArray(patientIdValue) ? patientIdValue[0] || "" : patientIdValue || "";
    const query = Array.isArray(queryValue) ? queryValue[0] || "" : queryValue || "";
    const { patients, selectedPatient } = await getPatientWorkspace(query, patientId);

    return (
        <PatientWorkspace
            initialPatients={patients}
            initialSelectedPatient={selectedPatient}
        />
    );
}
