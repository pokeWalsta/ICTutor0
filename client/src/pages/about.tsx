import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const teamMembers = {
  developers: [
    { name: "Mark Gabriel V. Labana", role: "Developer" },
    { name: "Ez Ezekiel Casilan", role: "Developer" },
  ],
  designers: [
    { name: "Bryan Dave DG. Andalio", role: "UI Designer" },
  ],
  helpers: [
    { name: "Gennard M. Pestijo", role: "Helper" },
    { name: "Charlie Marr M. Morillo", role: "Helper" },
    { name: "Mark Anthory E. Ceniza", role: "Helper" },
    { name: "Alfonso Miguel Dulva", role: "Helper" },
    { name: "Tristan Brent Mangila", role: "Helper" },
  ],
};

export default function About() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <img 
          src="https://cdn.discordapp.com/attachments/701395498418044958/1334517086940172328/20250130_213222.png?ex=67d77c23&is=67d62aa3&hm=0a652e2b63d9f0c76538644a04c952f3d53c247cf4cbf62ceea65041a652a3c7&" 
          alt="ICTutor Logo" 
          className="h-24 w-24 mx-auto mb-4"
        />
        <h1 className="text-4xl font-bold mb-4">About ICTutor</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          ICTutor was born from a vision to create an inclusive platform where students
          and professionals can learn and discuss Information & Communication Technology
          in a collaborative environment.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Our Purpose</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                We aim to bridge the gap between theoretical knowledge and practical application
                in ICT education. Our platform provides a space for meaningful discussions,
                knowledge sharing, and community-driven learning.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Our Team</h2>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Developers</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {teamMembers.developers.map((member) => (
                  <div key={member.name} className="flex justify-between items-center">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground">{member.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Design Team</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {teamMembers.designers.map((member) => (
                  <div key={member.name} className="flex justify-between items-center">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground">{member.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support Team</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {teamMembers.helpers.map((member) => (
                  <div key={member.name} className="flex justify-between items-center">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground">{member.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}