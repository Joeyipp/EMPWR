import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Search,
  User,
  Mail,
  Globe,
  BookOpen,
  BarChart3,
  TrendingUp,
  Users,
  Brain,
  Sparkles,
  Save,
  Check,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import PageLayout from "@/components/PageLayout";
import KnowledgeGraphExplorer from "@/components/KnowledgeGraphExplorer";

const authorSearchSchema = z.object({
  authorId: z.string().min(1, "Author ID is required").trim(),
  publicationLimit: z
    .number()
    .min(0, "Must be 0 or greater")
    .max(100, "Maximum 100 publications")
    .default(10),
});

const rfpAnalysisSchema = z.object({
  projectDescription: z
    .string()
    .min(10, "Project description must be at least 10 characters")
    .trim(),
  requiredSkills: z
    .string()
    .min(5, "Required skills must be at least 5 characters")
    .trim(),
  projectDomain: z
    .string()
    .min(3, "Project domain must be at least 3 characters")
    .trim(),
});

type AuthorSearchValues = z.infer<typeof authorSearchSchema>;
type RfpAnalysisValues = z.infer<typeof rfpAnalysisSchema>;

interface Publication {
  container_type: string;
  source: string;
  bib: {
    title: string;
    pub_year: string;
    citation: string;
  };
  filled: boolean;
  author_pub_id: string;
  num_citations: number;
  citedby_url: string;
  cites_id: string[];
}

interface AuthorData {
  status: string;
  result: {
    name: string;
    url_picture: string;
    affiliation: string;
    interests: string[];
    email_domain: string;
    homepage: string;
    citedby: number;
    citedby5y: number;
    hindex: number;
    hindex5y: number;
    i10index: number;
    i10index5y: number;
    cites_per_year: Record<string, number>;
    publications: Publication[];
    public_access: {
      available: number;
      not_available: number;
    };
  };
}

export default function GoogleScholar() {
  const [authorData, setAuthorData] = useState<AuthorData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expertiseGraph, setExpertiseGraph] = useState<any>(null);
  const [biography, setBiography] = useState<string>("");
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [rfpAnalysis, setRfpAnalysis] = useState<any>(null);
  const [isAnalyzingRfp, setIsAnalyzingRfp] = useState(false);

  // Persist AI analysis results using localStorage
  const [persistedAnalysis, setPersistedAnalysis] = useState<{
    authorId: string;
    expertiseGraph: any;
    biography: string;
  } | null>(null);

  // Load persisted analysis from localStorage on component mount
  useEffect(() => {
    const savedAnalysis = localStorage.getItem("scholar_ai_analysis");
    if (savedAnalysis) {
      try {
        setPersistedAnalysis(JSON.parse(savedAnalysis));
      } catch (error) {
        console.error("Error parsing saved analysis:", error);
        localStorage.removeItem("scholar_ai_analysis");
      }
    }
  }, []);

  // Restore analysis when author data is loaded and matches persisted data
  useEffect(() => {
    if (
      authorData &&
      persistedAnalysis &&
      persistedAnalysis.authorId === form.getValues("authorId")
    ) {
      setExpertiseGraph(persistedAnalysis.expertiseGraph);
      setBiography(persistedAnalysis.biography);
    }
  }, [authorData, persistedAnalysis]);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const { toast } = useToast();

  // Query to fetch previously searched scholar profiles
  const { data: savedProfiles, refetch: refetchProfiles } = useQuery({
    queryKey: ["/api/scholar/profiles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/scholar/profiles");
      return response.json();
    },
  });

  // Mutation to delete a profile
  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: number) => {
      const response = await apiRequest("DELETE", `/api/scholar/profiles/${profileId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile deleted",
        description: "The profile has been removed from your search history.",
      });
      refetchProfiles();
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load persisted state on component mount
  useEffect(() => {
    const savedAuthorData = localStorage.getItem("useCases_authorData");
    const savedAuthorId = localStorage.getItem("useCases_authorId");
    const savedPublicationLimit = localStorage.getItem(
      "useCases_publicationLimit",
    );

    if (savedAuthorData) {
      try {
        setAuthorData(JSON.parse(savedAuthorData));
      } catch (error) {
        console.error("Error loading saved author data:", error);
      }
    }

    if (savedAuthorId) {
      form.setValue("authorId", savedAuthorId);
    }

    if (savedPublicationLimit) {
      form.setValue("publicationLimit", parseInt(savedPublicationLimit, 10));
    }
  }, []);

  const form = useForm<AuthorSearchValues>({
    resolver: zodResolver(authorSearchSchema),
    defaultValues: {
      authorId: "",
      publicationLimit: 10,
    },
  });

  const rfpForm = useForm<RfpAnalysisValues>({
    resolver: zodResolver(rfpAnalysisSchema),
    defaultValues: {
      projectDescription: "",
      requiredSkills: "",
      projectDomain: "",
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (data: AuthorSearchValues) => {
      const response = await apiRequest("POST", "/api/scholar/author", {
        authorId: data.authorId,
        publicationLimit: data.publicationLimit,
      });
      return response.json();
    },
    onSuccess: async (data: AuthorData, variables: AuthorSearchValues) => {
      if (data.status === "success") {
        setAuthorData(data);
        setCurrentPage(1); // Reset to first page on new search

        // Reset AI expertise analysis when searching for a new profile
        setExpertiseGraph(null);
        setBiography("");
        setPersistedAnalysis(null);
        localStorage.removeItem("scholar_ai_analysis");

        // Auto-save the profile to database
        try {
          await saveProfileMutation.mutateAsync({
            authorId: variables.authorId,
            name: data.result.name,
            profileData: data.result,
            expertiseGraph: null,
            biography: null,
            expertiseGraphId: null,
          });
          setIsProfileSaved(true);
        } catch (error) {
          console.log("Auto-save failed, user can manually save later");
          setIsProfileSaved(false);
        }

        // Persist the data and search query
        localStorage.setItem("useCases_authorData", JSON.stringify(data));
        localStorage.setItem("useCases_authorId", variables.authorId);
        localStorage.setItem(
          "useCases_publicationLimit",
          variables.publicationLimit.toString(),
        );

        toast({
          title: "Author found",
          description: `Successfully retrieved data for ${data.result.name}`,
        });

        // Check for API keys and automatically generate AI expertise analysis
        setTimeout(async () => {
          try {
            // Check if user has API keys before attempting generation
            const openaiResponse = await fetch('/api/api-keys/openai/active');
            const mistralResponse = await fetch('/api/api-keys/mistral/active');
            
            const openaiData = await openaiResponse.json();
            const mistralData = await mistralResponse.json();
            
            if (openaiData.success || mistralData.success) {
              generateExpertiseMutation.mutate(data);
            } else {
              console.log('No API keys found for automatic expertise generation');
            }
          } catch (error) {
            console.log('Could not check API keys for automatic generation');
          }
        }, 500);
      } else {
        toast({
          title: "Search failed",
          description: "Unable to find author data",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("Google Scholar API error: 500")) {
        toast({
          title: "Google Scholar Service Unavailable",
          description: "The Google Scholar service is temporarily unavailable. Please try again later or use the previously searched profiles dropdown.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Search failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  // Mutation to save scholar profile
  const saveProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest(
        "POST",
        "/api/scholar/profiles",
        profileData,
      );
      return response.json();
    },
  });

  const generateExpertiseMutation = useMutation({
    mutationFn: async (authorData: AuthorData) => {
      const response = await apiRequest(
        "POST",
        "/api/scholar/generate-expertise",
        { authorData },
      );
      return response.json();
    },
    onSuccess: async (data: any) => {
      if (data.success) {
        setExpertiseGraph(data.data.knowledgeGraph);
        setBiography(data.data.biography);
        setIsGeneratingGraph(false);

        // Persist the analysis results for navigation
        const analysisData = {
          authorId: form.getValues("authorId"),
          expertiseGraph: data.data.knowledgeGraph,
          biography: data.data.biography,
        };
        setPersistedAnalysis(analysisData);
        localStorage.setItem(
          "scholar_ai_analysis",
          JSON.stringify(analysisData),
        );

        // Update the profile with expertise data
        if (authorData) {
          const authorId = form.getValues("authorId");
          try {
            await saveProfileMutation.mutateAsync({
              authorId: authorId,
              name: authorData.result.name,
              profileData: authorData.result,
              expertiseGraph: data.data.knowledgeGraph,
              biography: data.data.biography,
              expertiseGraphId: null,
            });
            // Refresh the profiles list to show updated data
            refetchProfiles();
          } catch (error) {
            console.log("Profile update failed:", error);
          }
        }

        toast({
          title: "Expertise analysis complete",
          description:
            "Knowledge graph and biography have been generated and saved.",
        });
      } else {
        toast({
          title: "Generation failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setIsGeneratingGraph(false);
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rfpAnalysisMutation = useMutation({
    mutationFn: async (
      data: RfpAnalysisValues & { authorData: AuthorData },
    ) => {
      const response = await apiRequest("POST", "/api/scholar/rfp-analysis", {
        projectDescription: data.projectDescription,
        requiredSkills: data.requiredSkills,
        projectDomain: data.projectDomain,
        authorData: data.authorData,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsAnalyzingRfp(false);
      if (data.success) {
        setRfpAnalysis(data.data);
        toast({
          title: "RFP Analysis Complete",
          description: "Project-researcher match analysis has been generated.",
        });
      } else {
        toast({
          title: "Analysis failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setIsAnalyzingRfp(false);
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateExpertise = async () => {
    if (authorData) {
      // Check for API keys before attempting generation
      try {
        const openaiResponse = await fetch('/api/api-keys/openai/active');
        const mistralResponse = await fetch('/api/api-keys/mistral/active');
        
        const openaiData = await openaiResponse.json();
        const mistralData = await mistralResponse.json();
        
        if (!openaiData.success && !mistralData.success) {
          toast({
            title: "API Key Required",
            description: "Please add an OpenAI or Mistral API key in Settings to generate expertise analysis.",
            variant: "destructive",
          });
          return;
        }
        
        setIsGeneratingGraph(true);
        generateExpertiseMutation.mutate(authorData);
      } catch (error) {
        toast({
          title: "Error checking API keys",
          description: "Please try again or check your Settings.",
          variant: "destructive",
        });
      }
    }
  };

  const handleRfpAnalysis = (data: RfpAnalysisValues) => {
    if (authorData) {
      setIsAnalyzingRfp(true);
      rfpAnalysisMutation.mutate({ ...data, authorData });
    }
  };

  const handleSaveProfile = async () => {
    if (authorData) {
      const authorId = form.getValues("authorId");
      try {
        await saveProfileMutation.mutateAsync({
          authorId: authorId,
          name: authorData.result.name,
          profileData: authorData.result,
          expertiseGraph: expertiseGraph,
          biography: biography,
          expertiseGraphId: null,
        });

        setIsProfileSaved(true);

        toast({
          title: "Profile saved",
          description: "Scholar profile has been saved successfully.",
        });
      } catch (error) {
        toast({
          title: "Save failed",
          description: "Failed to save scholar profile.",
          variant: "destructive",
        });
      }
    }
  };

  const onSubmit = (data: AuthorSearchValues) => {
    searchMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-900 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header - Minimalistic design */}
          <div className="py-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-4">
                Google Scholar Integration
              </h1>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Search academic profiles and generate expertise knowledge graphs
              </p>
            </div>
          </div>

          {/* Search Form */}
          <Card className="mb-8 bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Search className="w-5 h-5" />
                Google Scholar Author Search
              </CardTitle>
              <CardDescription className="text-gray-300">
                Enter a Google Scholar author ID to retrieve detailed academic
                profile information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Previously Searched Profiles Dropdown */}
              {(savedProfiles?.success && savedProfiles.data.length > 0) || authorData?.status === "success" ? (
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-200 mb-2 block">
                    Previously Searched Profiles
                  </label>
                  <div className="flex gap-2">
                    <Select
                      value={form.getValues("authorId") || ""}
                      onValueChange={(authorId) => {
                        const profile = savedProfiles?.data.find(
                          (p: any) => p.authorId === authorId,
                        );
                        if (profile) {
                          setAuthorData({
                            status: "success",
                            result: profile.profileData,
                          });
                          form.setValue("authorId", authorId);

                          // Load saved AI expertise analysis if available
                          if (profile.expertiseGraph) {
                            setExpertiseGraph(profile.expertiseGraph);

                            const analysisData = {
                              authorId: authorId,
                              expertiseGraph: profile.expertiseGraph,
                              biography: profile.biography || "",
                            };
                            setPersistedAnalysis(analysisData);
                            localStorage.setItem(
                              "scholar_ai_analysis",
                              JSON.stringify(analysisData),
                            );
                          } else {
                            setExpertiseGraph(null);
                            setPersistedAnalysis(null);
                            localStorage.removeItem("scholar_ai_analysis");
                          }

                          setBiography(profile.biography || "");
                          setIsProfileSaved(true);

                          toast({
                            title: "Profile loaded",
                            description: `Switched to ${profile.name}`,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white flex-1">
                        <SelectValue placeholder="Select a previously searched author">
                          {authorData?.status === "success" ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{authorData.result.name}</span>
                              {expertiseGraph && (
                                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300">
                                  Analyzed
                                </Badge>
                              )}
                            </div>
                          ) : (
                            "Select a previously searched author"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {savedProfiles?.success && savedProfiles.data.map((profile: any) => (
                          <SelectItem key={profile.id} value={profile.authorId}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{profile.name}</span>
                              <span className="text-xs text-gray-400">
                                ({new Date(profile.updatedAt).toLocaleDateString()})
                              </span>
                              {profile.expertiseGraph && (
                                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300">
                                  Analyzed
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Delete button for current profile */}
                    {authorData?.status === "success" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const currentProfile = savedProfiles?.data.find(
                            (p: any) => p.authorId === form.getValues("authorId")
                          );
                          if (currentProfile) {
                            deleteProfileMutation.mutate(currentProfile.id);
                          }
                        }}
                        disabled={deleteProfileMutation.isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2"
                        title="Delete current profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Separator className="my-4 bg-gray-600" />
                </div>
              ) : null}

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="authorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-200">
                            Author ID
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., KnPFcT4AAAAJ"
                              {...field}
                              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-400">
                            Enter the Google Scholar author ID (found in the
                            author's profile URL)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="publicationLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-200">
                            Publication Limit
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="10"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 10)
                              }
                              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-400">
                            Number of publications to retrieve (1-100, enter 0
                            to retrieve all publications)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={searchMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {searchMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Search Author
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Author Results */}
          {authorData && (
            <div className="space-y-6">
              {/* Author Profile */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Author Profile
                    </div>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={saveProfileMutation.isPending}
                      className={`${
                        isProfileSaved
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {saveProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : isProfileSaved ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Profile Saved
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Profile
                        </>
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-6">
                    <Avatar className="w-24 h-24">
                      <AvatarImage
                        src={authorData.result.url_picture}
                        alt={authorData.result.name}
                      />
                      <AvatarFallback className="text-lg bg-blue-100 text-blue-700">
                        {getInitials(authorData.result.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          {authorData.result.name}
                        </h2>
                        <p className="text-gray-300 mt-1">
                          {authorData.result.affiliation}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-300">
                            <Mail className="w-4 h-4" />
                            <span>
                              Email domain: {authorData.result.email_domain}
                            </span>
                          </div>
                          {authorData.result.homepage && (
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                              <Globe className="w-4 h-4" />
                              <a
                                href={authorData.result.homepage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                              >
                                Personal Homepage
                              </a>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="font-medium text-white mb-2">
                            Research Interests
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {authorData.result.interests.map(
                              (interest, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="bg-blue-600 text-white"
                                >
                                  {interest}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Citation Metrics */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BarChart3 className="w-5 h-5" />
                    Citation Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400">
                        {formatNumber(authorData.result.citedby)}
                      </div>
                      <div className="text-sm text-gray-300">
                        Total Citations
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">
                        {authorData.result.hindex}
                      </div>
                      <div className="text-sm text-gray-300">h-index</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400">
                        {authorData.result.i10index}
                      </div>
                      <div className="text-sm text-gray-300">i10-index</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-400">
                        {formatNumber(authorData.result.citedby5y)}
                      </div>
                      <div className="text-sm text-gray-300">
                        Citations (5 years)
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6 bg-gray-600" />

                  <div>
                    <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Citations per Year
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {Object.entries(authorData.result.cites_per_year)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .slice(0, 10)
                        .map(([year, citations]) => (
                          <div
                            key={year}
                            className="bg-gray-700 p-3 rounded-lg text-center"
                          >
                            <div className="font-semibold text-white">
                              {citations}
                            </div>
                            <div className="text-sm text-gray-300">{year}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Publications */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-white">
                      <BookOpen className="w-5 h-5" />
                      Publications ({authorData.result.publications.length})
                    </CardTitle>
                    <div className="text-sm text-gray-400">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * itemsPerPage + 1,
                        authorData.result.publications.length,
                      )}
                      -
                      {Math.min(
                        currentPage * itemsPerPage,
                        authorData.result.publications.length,
                      )}{" "}
                      of {authorData.result.publications.length}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-600">
                        <TableHead className="text-gray-300">Title</TableHead>
                        <TableHead className="w-24 text-gray-300">
                          Year
                        </TableHead>
                        <TableHead className="w-32 text-gray-300">
                          Citations
                        </TableHead>
                        <TableHead className="w-48 text-gray-300">
                          Publication
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {authorData.result.publications
                        .slice(
                          (currentPage - 1) * itemsPerPage,
                          currentPage * itemsPerPage,
                        )
                        .map((pub, index) => (
                          <TableRow
                            key={(currentPage - 1) * itemsPerPage + index}
                            className="border-gray-600 hover:bg-gray-700"
                          >
                            <TableCell className="font-medium text-white">
                              {pub.bib.title}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {pub.bib.pub_year}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-blue-600 text-white border-blue-500"
                              >
                                {formatNumber(pub.num_citations)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-300 truncate max-w-48">
                              {pub.bib.citation}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>

                  {/* Pagination Controls */}
                  {Math.ceil(
                    authorData.result.publications.length / itemsPerPage,
                  ) > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                      <div className="text-sm text-gray-400">
                        Page {currentPage} of{" "}
                        {Math.ceil(
                          authorData.result.publications.length / itemsPerPage,
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(
                                prev + 1,
                                Math.ceil(
                                  authorData.result.publications.length /
                                    itemsPerPage,
                                ),
                              ),
                            )
                          }
                          disabled={
                            currentPage ===
                            Math.ceil(
                              authorData.result.publications.length /
                                itemsPerPage,
                            )
                          }
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI-Powered Expertise Analysis */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-white">
                      <BarChart3 className="w-5 h-5" />
                      Expertise Analysis
                    </CardTitle>
                    <Button
                      onClick={handleGenerateExpertise}
                      disabled={
                        isGeneratingGraph || generateExpertiseMutation.isPending
                      }
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isGeneratingGraph ||
                      generateExpertiseMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Generate Knowledge Graph
                        </>
                      )}
                    </Button>
                  </div>
                  {!expertiseGraph && !isGeneratingGraph && (
                    <CardDescription className="text-gray-300">
                      Analyze research interests and publications to generate an
                      expertise knowledge graph and biography
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {biography && (
                    <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                      <h4 className="font-medium text-white mb-2">
                        Generated Biography
                      </h4>
                      <p className="text-gray-300 leading-relaxed">
                        {biography}
                      </p>
                    </div>
                  )}

                  {expertiseGraph && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-white">
                        Expertise Knowledge Graph
                      </h4>
                      <div className="bg-gray-700 rounded-lg overflow-hidden h-96">
                        <KnowledgeGraphExplorer
                          knowledgeGraph={expertiseGraph}
                          hideControls={true}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {expertiseGraph.nodes
                          ?.filter((node: any) => node.type === "topic")
                          .slice(0, 5)
                          .map((node: any, index: number) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-purple-600 text-white"
                            >
                              {node.name}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {!expertiseGraph && !isGeneratingGraph && (
                    <div className="text-center py-8 text-gray-400">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>
                        Click "Generate Knowledge Graph" to analyze this
                        author's expertise
                      </p>
                      <p className="text-sm mt-2">
                        Requires OpenAI API key in Settings
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RFP Analysis Section */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Sparkles className="w-5 h-5" />
                    Project Match Analysis
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Get AI-powered insights on how well this researcher aligns
                    with your project requirements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...rfpForm}>
                    <form
                      onSubmit={rfpForm.handleSubmit(handleRfpAnalysis)}
                      className="space-y-4"
                    >
                      <FormField
                        control={rfpForm.control}
                        name="projectDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Project Description
                            </FormLabel>
                            <FormControl>
                              <textarea
                                {...field}
                                placeholder="Describe your project vision, objectives, and expected outcomes. What problem are you solving?"
                                className="w-full min-h-[120px] bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none rounded-lg p-4"
                                rows={5}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={rfpForm.control}
                        name="requiredSkills"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Required Skills & Technologies
                            </FormLabel>
                            <FormControl>
                              <textarea
                                {...field}
                                placeholder="List specific technical skills, programming languages, frameworks, methodologies, and domain expertise required..."
                                className="w-full min-h-[100px] bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none rounded-lg p-4"
                                rows={4}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={rfpForm.control}
                        name="projectDomain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Project Domain
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., Artificial Intelligence, Cybersecurity, Biotechnology, Fintech..."
                                className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="pt-4">
                        <Button
                          type="submit"
                          disabled={
                            isAnalyzingRfp || rfpAnalysisMutation.isPending
                          }
                          className="w-full h-14 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl"
                        >
                          {isAnalyzingRfp || rfpAnalysisMutation.isPending ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                              <span className="text-lg">
                                Analyzing Compatibility...
                              </span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-3" />
                              <span className="text-lg">
                                Analyze Project Match
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>

                  {/* RFP Analysis Results */}
                  {rfpAnalysis && (
                    <div className="mt-8 space-y-6">
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent"></div>
                      <div className="space-y-6">
                        <div className="text-center">
                          <h4 className="font-bold text-white text-2xl mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Match Analysis Results
                          </h4>
                          <p className="text-gray-400">
                            Comprehensive compatibility assessment
                          </p>
                        </div>

                        {/* Overall Match Score - Enhanced */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 p-6 rounded-2xl text-center backdrop-blur-sm">
                            <div className="text-4xl font-bold text-green-400 mb-2">
                              {rfpAnalysis.analysis.overallMatch}%
                            </div>
                            <div className="text-sm text-green-300 font-medium">
                              Overall Match
                            </div>
                            <div className="mt-3 w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-1000"
                                style={{
                                  width: `${rfpAnalysis.analysis.overallMatch}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 p-6 rounded-2xl text-center backdrop-blur-sm">
                            <div className="text-2xl font-bold text-blue-400 mb-2">
                              {rfpAnalysis.analysis.matchScore}
                            </div>
                            <div className="text-sm text-blue-300 font-medium">
                              Match Grade
                            </div>
                            <div
                              className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold ${
                                rfpAnalysis.analysis.matchScore === "Excellent"
                                  ? "bg-green-500/20 text-green-300"
                                  : rfpAnalysis.analysis.matchScore === "Good"
                                    ? "bg-blue-500/20 text-blue-300"
                                    : rfpAnalysis.analysis.matchScore === "Fair"
                                      ? "bg-yellow-500/20 text-yellow-300"
                                      : "bg-red-500/20 text-red-300"
                              }`}
                            >
                              {rfpAnalysis.analysis.experienceLevel} Level
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 p-6 rounded-2xl text-center backdrop-blur-sm">
                            <div className="text-4xl font-bold text-purple-400 mb-2">
                              {rfpAnalysis.analysis.domainAlignment}%
                            </div>
                            <div className="text-sm text-purple-300 font-medium">
                              Domain Alignment
                            </div>
                            <div className="mt-3 w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full transition-all duration-1000"
                                style={{
                                  width: `${rfpAnalysis.analysis.domainAlignment}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Analysis Cards Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Strengths */}
                          <div className="bg-gradient-to-br from-green-600/10 to-green-800/10 border border-green-500/20 p-6 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-green-500/20 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-400" />
                              </div>
                              <h5 className="font-bold text-green-400 text-lg">
                                Key Strengths
                              </h5>
                            </div>
                            <div className="space-y-3">
                              {rfpAnalysis.analysis.strengths.map(
                                (strength: string, index: number) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/10"
                                  >
                                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <span className="text-gray-200 leading-relaxed">
                                      {strength}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          {/* Gaps */}
                          <div className="bg-gradient-to-br from-red-600/10 to-red-800/10 border border-red-500/20 p-6 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-red-500/20 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-red-400" />
                              </div>
                              <h5 className="font-bold text-red-400 text-lg">
                                Potential Gaps
                              </h5>
                            </div>
                            <div className="space-y-3">
                              {rfpAnalysis.analysis.gaps.map(
                                (gap: string, index: number) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 p-3 bg-red-500/5 rounded-lg border border-red-500/10"
                                  >
                                    <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <span className="text-gray-200 leading-relaxed">
                                      {gap}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Recommendations */}
                        <div className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 border border-blue-500/20 p-6 rounded-2xl backdrop-blur-sm">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                              <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <h5 className="font-bold text-blue-400 text-xl">
                              Strategic Recommendations
                            </h5>
                          </div>
                          <div className="grid gap-3">
                            {rfpAnalysis.analysis.recommendations.map(
                              (rec: string, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 hover:bg-blue-500/10 transition-colors"
                                >
                                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-blue-400 text-sm font-bold">
                                      {index + 1}
                                    </span>
                                  </div>
                                  <span className="text-gray-200 leading-relaxed">
                                    {rec}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
